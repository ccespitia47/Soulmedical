import { useEffect, useRef, useState } from "react";
import { useSubmissionsStore } from "../store/useSubmissionsStore";
import { useFolderStore } from "../store/useFolderStore";
import { useUsersStore } from "../store/useUsersStore";
import { useAuthStore } from "../store/useAuthStore";
import { sendFormEmail, type EmailAttachment } from "../services/emailService";
import { resolveLookupRecipients } from "../utils/resolveLookupRecipients";
import { evaluateRules, extractRowsFromValues } from "../utils/formRules";
import { htmlToPdfBase64 } from "../utils/pdfExporter";
import { fetchRenderedPdfFile } from "../services/pdfPreview";
import { fetchRenderedPdf } from "../services/excelPreview";
import { blobToBase64 } from "../utils/blobToBase64";
import { saveDraft, loadDraft, deleteDraft } from "../utils/formDrafts";
import { buildEmailFormData, expandFormData, renderFilename } from "../utils/placeholders";
import type { FormRule, WidgetInstance } from "../types/widget.types";
import FormHeader from "../components/form/FormHeader";
import FormBody from "../components/form/FormBody";
import MissingFieldsModal from "../components/form/MissingFieldsModal";
import SuccessModal, { type EmailStatus } from "../components/form/SuccessModal";
import QuizReviewModal from "../components/form/QuizReviewModal";
import { computeQuizReview } from "../lib/quizReview";

type FormPageProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  rules?: FormRule[];
  onClose?: () => void;
  isPublic?: boolean;
};

export default function FormPage({
  formId,
  folderId,
  formName,
  widgets,
  rules = [],
  onClose,
  isPublic = false,
}: FormPageProps) {
  const { addSubmission } = useSubmissionsStore();
  const { folders } = useFolderStore();
  const { users, loadUsers, loaded: usersLoaded } = useUsersStore();
  const { currentUser } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!usersLoaded) loadUsers();
  }, [usersLoaded, loadUsers]);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const hiddenWidgetIds = evaluateRules(
    rules,
    fieldValues,
    extractRowsFromValues(fieldValues),
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    const draft = loadDraft(currentUser.id, folderId, formId);
    if (!draft) return;
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      for (const [key, value] of Object.entries(draft.values)) {
        const input = form.elements.namedItem(key) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (input && "value" in input) input.value = value;
      }
      setFieldValues(draft.values);
    });
  }, [currentUser?.id, folderId, formId]);

  const handleFormChange = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const values: Record<string, string> = {};
    widgets.forEach((w) => {
      values[w.id] = String(fd.get(w.id) ?? "");
      // Widgets `search` emiten también `${id}__row` con la fila completa
      // seleccionada (JSON). Lo necesitan las reglas con columna (ej.
      // "Id Paciente.nombres es Margarita") y la validación de destinatarios
      // tipo field+column. Sin esta clave en fieldValues, extractRowsFromValues
      // devuelve {} y las condiciones por columna siempre fallan.
      if (w.type === "search") {
        const row = fd.get(`${w.id}__row`);
        if (typeof row === "string" && row) values[`${w.id}__row`] = row;
      }
    });
    setFieldValues(values);

    if (currentUser?.id) {
      saveDraft({
        userId: currentUser.id,
        folderId,
        formId,
        formName,
        values,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Un widget (ej. search) puede pedir rellenar valores en otros widgets del
  // form. Actualizamos el DOM de los inputs por su `name` y disparamos un
  // evento input para que cualquier subscriber (React onChange interno de
  // algún widget, y nuestro handleFormChange) se entere.
  const handleWidgetValues = (values: Record<string, string>) => {
    const form = formRef.current;
    if (!form) return;
    // Setter nativo de HTMLInputElement.value que respeta React (importante
    // para inputs controlados con React 19: evita que React ignore el cambio).
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    const nativeSelectSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;

    // Agrupa los valores dirigidos a sub-campos de un mismo subform para
    // agregarlos como UNA entry (no una por campo).
    const subformFills = new Map<string, Record<string, string>>();

    for (const [name, value] of Object.entries(values)) {
      // Formato "subformId:fieldId" → destino dentro de un subform.
      if (name.includes(":")) {
        const [subformId, fieldId] = name.split(":", 2);
        if (!subformId || !fieldId) continue;
        const bag = subformFills.get(subformId) ?? {};
        bag[fieldId] = value;
        subformFills.set(subformId, bag);
        continue;
      }
      // Widget top-level: setear el input nativo dentro del form.
      const el = form.elements.namedItem(name) as HTMLElement | RadioNodeList | null;
      if (!el || el instanceof RadioNodeList) continue;
      if (el instanceof HTMLInputElement && nativeInputSetter) {
        nativeInputSetter.call(el, value);
      } else if (el instanceof HTMLTextAreaElement && nativeTextareaSetter) {
        nativeTextareaSetter.call(el, value);
      } else if (el instanceof HTMLSelectElement && nativeSelectSetter) {
        nativeSelectSetter.call(el, value);
      } else {
        continue;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Notifica a cada subform destino con todos los sub-valores agrupados.
    // Subform.render escucha el evento y agrega una entry con los datos.
    for (const [subformId, fill] of subformFills) {
      window.dispatchEvent(
        new CustomEvent("subform:fill", { detail: { subformId, values: fill } }),
      );
    }

    handleFormChange();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const formEl = e.target as HTMLFormElement;
    const formData = new FormData(formEl);

    const missing: string[] = [];
    widgets.forEach((widget) => {
      if (widget.required && !hiddenWidgetIds.has(widget.id)) {
        const value = formData.get(widget.id);
        if (!value || (typeof value === "string" && !value.trim()))
          missing.push(widget.label);
      }
    });

    // Validar destinatarios de email tipo "field": si el admin eligió un
    // widget del formulario (o una columna de un search) como destinatario,
    // ese widget debe tener valor al momento de enviar — sino no sabemos a
    // quién mandar. Regla acordada: fallar y avisar al usuario. Con multi-
    // templates, chequeamos TODAS las configs habilitadas (una falla en
    // cualquiera basta para bloquear el envío).
    const folderNow = folders.find((f) => f.id === folderId);
    const formConfigNow = folderNow?.forms.find((fm) => fm.id === formId);
    const templatesNow =
      formConfigNow?.emailTemplates && formConfigNow.emailTemplates.length > 0
        ? formConfigNow.emailTemplates
        : formConfigNow?.emailTemplate
        ? [formConfigNow.emailTemplate]
        : [];
    for (const tplNow of templatesNow) {
      if (!tplNow.enabled) continue;
      const allRecipients = [
        ...(tplNow.toRecipients ?? []),
        ...(tplNow.ccRecipients ?? []),
        ...(tplNow.bccRecipients ?? []),
      ];
      for (const r of allRecipients) {
        if (r.type !== "field" || !r.widgetId) continue;
        const w = widgets.find((x) => x.id === r.widgetId);
        if (!w || hiddenWidgetIds.has(w.id)) continue;
        if (r.column) {
          const rowRaw = formData.get(`${r.widgetId}__row`);
          let ok = false;
          if (typeof rowRaw === "string" && rowRaw) {
            try {
              const row = JSON.parse(rowRaw) as Record<string, unknown>;
              const v = row[r.column];
              ok =
                (typeof v === "string" && v.trim() !== "") ||
                (typeof v === "number" && !Number.isNaN(v));
            } catch { ok = false; }
          }
          if (!ok) {
            missing.push(`Destinatario: ${w.label} (falta seleccionar en el buscador para obtener ${r.column})`);
          }
        } else {
          const v = formData.get(r.widgetId);
          if (!v || (typeof v === "string" && !v.trim())) {
            missing.push(`Destinatario: ${w.label} (está vacío)`);
          }
        }
      }
    }

    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setSubmitting(true);

    const data: Record<string, unknown> = {};
    widgets.forEach((widget) => {
      if (hiddenWidgetIds.has(widget.id)) return;
      const value = formData.get(widget.id);
      if (!value) { data[widget.id] = ""; return; }
      const str = String(value);
      if (str.startsWith("{") || str.startsWith("[")) {
        try { data[widget.id] = JSON.parse(str); return; } catch { /* string */ }
      }
      data[widget.id] = str;
      // Para widgets `search`: también enviamos la fila completa seleccionada
      // (serializada como JSON) bajo la clave `${widgetId}__row`. El backend
      // la usa para resolver destinatarios tipo "field" con `column` (ej.
      // "ciudadDepartamento.email2") sin tener que recrear la fuente.
      if (widget.type === "search") {
        const row = formData.get(`${widget.id}__row`);
        if (typeof row === "string" && row) {
          data[`${widget.id}__row`] = row;
        }
      }
    });

    // ── Capturar nombre sugerido del PDF ────────────────────────────────────
    // El HTML snapshot ya NO se envía desde el cliente — el backend lo deriva
    // de form.emailTemplate.pdfTemplate para prevenir inyección HTML/JS que
    // después se rendería en Puppeteer. Sólo el nombre de archivo cruza el
    // borde de red (validado por regex estricta en el DTO).
    const folder = folders.find((f) => f.id === folderId);
    const formConfig = folder?.forms.find((fm) => fm.id === formId);
    // Fuente de verdad: array nuevo `emailTemplates`. Si está vacío
    // caemos al singular legacy para no romper formularios no migrados.
    const templates =
      formConfig?.emailTemplates && formConfig.emailTemplates.length > 0
        ? formConfig.emailTemplates
        : formConfig?.emailTemplate
        ? [formConfig.emailTemplate]
        : [];
    // El pdfFilename sugerido para la UI de "Mis envíos" lo tomamos del
    // primer template con pdfTemplate — mantiene la UX histórica.
    let pdfFilename: string | undefined;
    const firstWithPdf = templates.find(
      (t) => t.attachPDF && t.pdfTemplate?.trim(),
    );
    if (firstWithPdf) {
      try {
        const labeledDataForSnapshot = expandFormData(widgets, data, hiddenWidgetIds);
        pdfFilename = renderFilename(firstWithPdf.pdfFilename, labeledDataForSnapshot);
      } catch (e) {
        console.warn("No se pudo derivar el nombre sugerido del PDF:", e);
      }
    }

    addSubmission(
      { formId, folderId, data: data as Record<string, string> },
      pdfFilename,
    );

    if (currentUser?.id) deleteDraft(currentUser.id, folderId, formId);

    const enabledTemplates = templates.filter((t) => t.enabled);
    if (enabledTemplates.length > 0) {
      setEmailStatus("sending");
      try {
        const labeledData = expandFormData(widgets, data, hiddenWidgetIds);
        // Dispara UN envío por cada notificación habilitada. Cada una
        // trae su propio asunto, cuerpo, destinatarios y PDF (si
        // corresponde). Se envían en secuencia para que un fallo en una
        // no corte las demás; los errores se agregan y se reportan al
        // final para que el modal muestre un estado único al usuario.
        const errors: string[] = [];
        for (const template of enabledTemplates) {
          const attachments: EmailAttachment[] = [];

          // Excel mapeado → PDF (backend con LibreOffice + fillXlsx).
          if (template.excelBase64 && (template.excelMappings?.length ?? 0) > 0) {
            try {
              const result = await fetchRenderedPdf({
                excelBase64: template.excelBase64,
                mappings: template.excelMappings!.map((m) => ({
                  coord: m.coord,
                  placeholder: m.placeholder,
                })),
                values: labeledData,
                customLogoBase64: template.excelLogoBase64,
                filename:
                  template.excelFilename?.replace(/\.xlsx?$/i, "") ?? "formulario",
              });
              if (result.blob) {
                const base64 = await blobToBase64(result.blob);
                const configuredName = renderFilename(template.pdfFilename, labeledData);
                const attachmentName =
                  configuredName && configuredName !== "formulario.pdf"
                    ? configuredName
                    : template.excelFilename?.replace(/\.xlsx?$/i, ".pdf") ??
                      "formulario.pdf";
                attachments.push({
                  name: attachmentName,
                  contentType: "application/pdf",
                  contentBytes: base64,
                });
              } else if (result.error) {
                console.error("Error generando PDF del Excel:", result.error);
              }
            } catch (e) {
              console.error("Error generando PDF del Excel:", e);
            }
          }

          // PDF subido + mappings → overlay con pdf-lib.
          if (template.pdfBase64 && (template.pdfMappings?.length ?? 0) > 0) {
            try {
              const values: Record<string, string> = {};
              for (const [k, v] of Object.entries(labeledData)) {
                values[k] = v;
                values[`\${${k}}`] = v;
              }
              const result = await fetchRenderedPdfFile({
                pdfBase64: template.pdfBase64,
                mappings: template.pdfMappings!.map((m) => ({
                  placeholder: m.placeholder,
                  x: m.x,
                  y: m.y,
                  page: m.page,
                  fontSize: m.fontSize,
                })),
                values,
                filename: "formulario",
              });
              if (result.blob) {
                const base64 = await blobToBase64(result.blob);
                attachments.push({
                  name: renderFilename(template.pdfFilename, labeledData),
                  contentType: "application/pdf",
                  contentBytes: base64,
                });
              } else if (result.error) {
                console.error("Error rellenando PDF:", result.error);
              }
            } catch (e) {
              console.error("Error generando PDF con mappings:", e);
            }
          }

          // HTML template → PDF (fallback).
          if (template.attachPDF && template.pdfTemplate?.trim()) {
            try {
              const filled = template.pdfTemplate.replace(
                /\$\{([^}]+)\}/g,
                (_, key) => {
                  const raw = labeledData[key] ?? "";
                  if (raw.startsWith("data:image/")) {
                    return `<img src="${raw}" style="max-height:80px;max-width:100%;object-fit:contain;display:block;">`;
                  }
                  return raw;
                },
              );
              const base64 = await htmlToPdfBase64(filled);
              attachments.push({
                name: renderFilename(template.pdfFilename, labeledData),
                contentType: "application/pdf",
                contentBytes: base64,
              });
            } catch (e) {
              console.error("Error generando PDF del template HTML:", e);
            }
          }

          // Resolver destinatarios tipo "lookup" (contra Google Sheets externo).
          // Se calcula por template porque cada uno tiene sus propios
          // widget-ids de match / columnas de email.
          const resolvedRecipients = await resolveLookupRecipients(template, data);

          try {
            await sendFormEmail({
              template,
              formData: buildEmailFormData(widgets, data, hiddenWidgetIds),
              users,
              currentUser: currentUser ?? undefined,
              attachments,
              resolvedRecipients,
            });
          } catch (err) {
            console.error(
              `Error enviando email de la notificación "${template.label || template.id || "sin nombre"}":`,
              err,
            );
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
        if (errors.length > 0) {
          setEmailStatus("error");
          setEmailError(errors.join(" · "));
        } else {
          setEmailStatus("sent");
        }
      } catch (err) {
        console.error("Error enviando email:", err);
        setEmailStatus("error");
        setEmailError(err instanceof Error ? err.message : String(err));
      }
    }

    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setFieldValues({});
    setEmailStatus("idle");
    setEmailError(null);
    formRef.current?.reset();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8] font-sans">
      {!isPublic && <FormHeader formName={formName} onClose={onClose} />}
      <FormBody
        ref={formRef}
        formName={formName}
        widgets={widgets}
        hiddenWidgetIds={hiddenWidgetIds}
        submitting={submitting}
        onSubmit={handleSubmit}
        onChange={handleFormChange}
        onWidgetValues={handleWidgetValues}
        onCancel={onClose}
      />
      {missingFields.length > 0 && (
        <MissingFieldsModal fields={missingFields} onClose={() => setMissingFields([])} />
      )}
      {showSuccess && (() => {
        const review = computeQuizReview(widgets, fieldValues);
        if (review.hasReview) {
          return (
            <QuizReviewModal
              questions={review.questions}
              fieldValues={fieldValues}
              showCorrectness={review.showCorrectness}
              scoresToShow={review.scoresToShow}
              onClose={() => {
                handleCloseSuccess();
                onClose?.();
              }}
            />
          );
        }
        return (
          <SuccessModal
            emailStatus={emailStatus}
            emailError={emailError}
            onNewRegistration={handleCloseSuccess}
            onClose={onClose}
          />
        );
      })()}
    </div>
  );
}