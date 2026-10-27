import { useEffect, useRef, useState } from "react";
import type { EmailTemplate } from "../../../types/email-template.types";
import { useFolderStore } from "../../../store/useFolderStore";

/** Config vacía con un id recién creado. */
function emptyConfig(): EmailTemplate {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: false,
    subject: "",
    label: "",
    to: "",
    cc: "",
    bcc: "",
    replyTo: "",
    emailBody: "",
    attachPDF: true,
    pdfTemplate: "",
    pdfFilename: "formulario.pdf",
    toRecipients: [],
    ccRecipients: [],
    bccRecipients: [],
    senderName: "",
  };
}

/** Garantiza que cada config traída del store tenga id estable. */
function hydrate(configs: EmailTemplate[]): EmailTemplate[] {
  return configs.map((c, i) => ({
    ...c,
    id: c.id ?? `tpl-${i}`,
    toRecipients: c.toRecipients ?? [],
    ccRecipients: c.ccRecipients ?? [],
    bccRecipients: c.bccRecipients ?? [],
  }));
}

export type PdfMode = "html" | "upload" | "excel";

export function useEmailConfig(folderId: string | undefined, formId: string | undefined) {
  const { folders, updateFormEmailTemplates } = useFolderStore();
  const hasLoadedRef = useRef(false);

  // `configs` es la lista completa de notificaciones de este formulario.
  // Arranca con UNA config vacía para que el panel siempre tenga algo que
  // mostrar aunque el form no haya guardado nada todavía.
  const [configs, setConfigs] = useState<EmailTemplate[]>(() => [emptyConfig()]);
  // ID del panel actualmente expandido en el acordeón (null = todos cerrados).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Errores de validación por configuración (map { configId: string[] }).
  const [validationErrorsById, setValidationErrorsById] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!folderId || !formId || hasLoadedRef.current) return;
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (!form) return;
    // Fuente de verdad: `emailTemplates` nuevo. Si no, caemos a singular.
    const list: EmailTemplate[] | null =
      form.emailTemplates && form.emailTemplates.length > 0
        ? form.emailTemplates
        : form.emailTemplate
        ? [form.emailTemplate]
        : null;
    if (!list) return;
    setTimeout(() => {
      const hydrated = hydrate(list);
      setConfigs(hydrated);
      // Al abrir, expandimos la primera para que no quede todo plegado.
      setExpandedId(hydrated[0]?.id ?? null);
      hasLoadedRef.current = true;
    }, 0);
  }, [folderId, formId, folders]);

  // Helpers por config -----------------------------------------------------
  const updateConfig = (id: string, partial: Partial<EmailTemplate>) =>
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));

  const replaceConfig = (
    id: string,
    updater: (prev: EmailTemplate) => EmailTemplate,
  ) => setConfigs((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));

  const addConfig = () => {
    const next = emptyConfig();
    setConfigs((prev) => [...prev, next]);
    setExpandedId(next.id ?? null);
  };

  const removeConfig = (id: string) => {
    setConfigs((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // Nunca dejamos el array vacío — si borraron la última, repoblamos
      // con una config vacía para que la UI tenga algo que mostrar.
      return next.length > 0 ? next : [emptyConfig()];
    });
    setExpandedId((cur) => (cur === id ? null : cur));
    setValidationErrorsById((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const toggleExpanded = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const clearErrorContaining = (id: string, substr: string) =>
    setValidationErrorsById((prev) => ({
      ...prev,
      [id]: (prev[id] ?? []).filter((e) => !e.includes(substr)),
    }));

  // Validación -------------------------------------------------------------
  const validate = (): boolean => {
    const next: Record<string, string[]> = {};
    for (const c of configs) {
      const errors: string[] = [];
      // Config deshabilitada: no se dispara al enviar, así que no se valida.
      if (!c.enabled) continue;
      if ((c.toRecipients?.length ?? 0) === 0)
        errors.push("Debes agregar al menos un destinatario en Para (To)");
      if (!c.subject?.trim()) errors.push("El asunto no puede estar vacío");
      if (!c.emailBody?.trim()) errors.push("El cuerpo del email no puede estar vacío");
      if (errors.length > 0 && c.id) next[c.id] = errors;
    }
    setValidationErrorsById(next);
    return Object.keys(next).length === 0;
  };

  const save = (): boolean => {
    if (!folderId || !formId) return false;
    if (!validate()) return false;
    void updateFormEmailTemplates(folderId, formId, configs);
    return true;
  };

  return {
    configs,
    expandedId,
    validationErrorsById,
    addConfig,
    removeConfig,
    updateConfig,
    replaceConfig,
    toggleExpanded,
    clearErrorContaining,
    save,
  };
}
