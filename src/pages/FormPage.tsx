import { useState, useRef } from "react";
import { widgetRegistry } from "../components/widgets/registry";
import { useSubmissionsStore } from "../store/useSubmissionsStore";
import { useRulesStore } from "../store/useRulesStore";
import { useFolderStore } from "../store/useFolderStore";
import { useUsersStore } from "../store/useUsersStore";
import { useAuthStore } from "../store/useAuthStore";
import { sendFormEmail } from "../services/emailService";
import * as XLSX from "xlsx";
import type { WidgetInstance, FormRule } from "../types/widget.types";
import type { ExcelFieldMapping } from "../types/email-template.types";

// ─── Generar PDF del Excel con datos reales ───────────────────────────────────
function generateExcelHtml(
  excelBase64: string,
  mappings: ExcelFieldMapping[],
  formValues: Record<string, string>,
  logoBase64?: string,
): string | null {
  try {
    const raw = excelBase64.includes(",") ? excelBase64.split(",")[1] : excelBase64;
    const wb = XLSX.read(raw, { type: "base64" });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Merges
    const mergedSkip = new Set<string>();
    const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
    for (const m of ((ws["!merges"] as XLSX.Range[]) || [])) {
      const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      mergedMap[tl] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
      for (let r = m.s.r; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++) {
          const coord = XLSX.utils.encode_cell({ r, c });
          if (coord !== tl) mergedSkip.add(coord);
        }
    }

    // Mapa de placeholder → valor real
    const valueMap: Record<string, string> = {};
    for (const m of mappings) {
      const ph = m.placeholder;
      const key = ph.replace(/^\$\{/, "").replace(/\}$/, "");
      valueMap[m.coord] = formValues[key] ?? "";
    }

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
    const totalCols = range.e.c - range.s.c + 1;
    const isLandscape = totalCols > 7;

    // Leer anchos de columna reales del Excel
    const colWidthsPx: number[] = [];
    const wsCols = (ws["!cols"] as Array<{ wch?: number; wpx?: number }> | undefined) ?? [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const colInfo = wsCols[c];
      const px = colInfo?.wpx ?? (colInfo?.wch ? Math.round(colInfo.wch * 7) : 80);
      colWidthsPx.push(Math.max(px, 40));
    }

    // Alto útil de A4 en px a 96dpi menos márgenes de 6mm (≈23px c/u)
    const pageHeightPx = isLandscape ? 744 : 1056; // A4 landscape/portrait a 96dpi
    const marginPx = 46; // 6mm top + 6mm bottom
    const availableH = pageHeightPx - marginPx;

    // Leer alturas de fila reales del Excel
    const rowHeightsPx: number[] = [];
    const wsRows = (ws["!rows"] as Array<{ hpt?: number; hpx?: number }> | undefined) ?? [];
    let naturalTotalH = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowInfo = wsRows[r];
      const px = rowInfo?.hpx ?? (rowInfo?.hpt ? Math.round(rowInfo.hpt * 1.33) : 18);
      const h = Math.max(px, 14);
      rowHeightsPx.push(h);
      naturalTotalH += h;
    }

    // Si la tabla natural es más corta que la página, escalar cada fila proporcionalmente
    const scaleFactor = naturalTotalH < availableH ? availableH / naturalTotalH : 1;
    const finalRowHeights = rowHeightsPx.map(h => Math.floor(h * scaleFactor));

    // Construir filas HTML
    let tableRows = "";
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowH = finalRowHeights[r - range.s.r];
      tableRows += `<tr style="height:${rowH}px">`;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const coord = XLSX.utils.encode_cell({ r, c });
        if (mergedSkip.has(coord)) continue;
        const cell = ws[coord];
        const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };

        // Estilos de celda
        const cellStyle = cell?.s as { font?: { bold?: boolean; sz?: number }; fgColor?: { rgb?: string }; alignment?: { horizontal?: string; vertical?: string } } | undefined;
        const bgColor = cellStyle?.fgColor?.rgb ? `#${cellStyle.fgColor.rgb}` : null;
        const bold = cellStyle?.font?.bold ?? false;
        const fontSize = cellStyle?.font?.sz ? `${Math.round(cellStyle.font.sz * 1.1)}px` : "10px";
        const align = cellStyle?.alignment?.horizontal ?? "left";
        const valign = cellStyle?.alignment?.vertical ?? "middle";

        const rowNum = r + 1;
        const isHeader = rowNum <= 3;
        const isFooter = rowNum >= range.e.r - 2;
        const defaultBg = isHeader || isFooter ? "#e6f4f1" : "#ffffff";
        const finalBg = bgColor ?? defaultBg;

        let value = "";
        if (valueMap[coord] !== undefined) {
          value = valueMap[coord];
        } else if (cell?.v !== undefined && cell.v !== null) {
          value = String(cell.v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }

        const cellContent = (logoBase64 && r === range.s.r && c === range.s.c)
          ? `<img src="${logoBase64}" style="max-height:40px;max-width:100%;object-fit:contain;display:block">`
          : value;

        tableRows += `<td colspan="${merge.colspan}" rowspan="${merge.rowspan}" style="border:1px solid #9ca3af;padding:2px 5px;background:${finalBg};font-weight:${bold || isHeader ? "bold" : "normal"};font-size:${fontSize};text-align:${align};vertical-align:${valign};word-break:break-word;overflow:hidden">${cellContent}</td>`;
      }
      tableRows += "</tr>";
    }

    const colgroup = colWidthsPx.map(w => `<col style="width:${w}px">`).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      font-family: Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    @page { size: ${isLandscape ? "A4 landscape" : "A4 portrait"}; margin: 8mm; }
  </style>
</head>
<body>
  <table>
    <colgroup>${colgroup}</colgroup>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
  } catch (e) {
    console.error("Error generando HTML del Excel:", e);
    return null;
  }
}

type FormPageProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  onClose?: () => void;
  isPublic?: boolean;
};

// ─── Motor de reglas ──────────────────────────────────────────────────────────
function evaluateRules(rules: FormRule[], values: Record<string, string>): Set<string> {
  const hidden = new Set<string>();
  for (const rule of rules) {
    let conditionMet: boolean;
    if (rule.conditions.length === 0) {
      conditionMet = true;
    } else {
      const results = rule.conditions.map((cond) => {
        const val = (values[cond.widgetId] ?? "").toLowerCase().trim();
        const target = (cond.value ?? "").toLowerCase().trim();
        switch (cond.operator) {
          case "equals":     return val === target;
          case "not_equals": return val !== target;
          case "contains":   return val.includes(target);
          case "not_empty":  return val !== "";
          case "is_empty":   return val === "";
          default:           return false;
        }
      });
      conditionMet = rule.matchType === "all" ? results.every(Boolean) : results.some(Boolean);
    }
    if (conditionMet) {
      if (rule.action === "hide") rule.targetWidgetIds.forEach(id => hidden.add(id));
    } else {
      if (rule.action === "show") rule.targetWidgetIds.forEach(id => hidden.add(id));
    }
  }
  for (const rule of rules) {
    if (rule.action !== "show") continue;
    const results = rule.conditions.map((cond) => {
      const val = (values[cond.widgetId] ?? "").toLowerCase().trim();
      const target = (cond.value ?? "").toLowerCase().trim();
      switch (cond.operator) {
        case "equals":     return val === target;
        case "not_equals": return val !== target;
        case "contains":   return val.includes(target);
        case "not_empty":  return val !== "";
        case "is_empty":   return val === "";
        default:           return false;
      }
    });
    const met = rule.conditions.length === 0 || (rule.matchType === "all" ? results.every(Boolean) : results.some(Boolean));
    if (met) rule.targetWidgetIds.forEach(id => hidden.delete(id));
  }
  return hidden;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function FormPage({ formId, folderId, formName, widgets, onClose, isPublic = false }: FormPageProps) {
  const { addSubmission } = useSubmissionsStore();
  const { getRules } = useRulesStore();
  const { folders } = useFolderStore();
  const { users } = useUsersStore();
  const { currentUser } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const rules = getRules(formId);
  const hiddenWidgetIds = evaluateRules(rules, fieldValues);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const formEl = e.target as HTMLFormElement;
    const formData = new FormData(formEl);

    const missing: string[] = [];
    widgets.forEach((widget) => {
      if (widget.required && !hiddenWidgetIds.has(widget.id)) {
        const value = formData.get(widget.id);
        if (!value || (typeof value === "string" && !value.trim())) missing.push(widget.label);
      }
    });
    if (missing.length > 0) { setMissingFields(missing); return; }

    setSubmitting(true);

    // Construir mapa widgetId → valor (puede ser objeto para widgets complejos como id_scanner)
    const data: Record<string, unknown> = {};
    widgets.forEach((widget) => {
      if (hiddenWidgetIds.has(widget.id)) return;
      const value = formData.get(widget.id);
      if (!value) { data[widget.id] = ""; return; }
      const str = String(value);
      if (str.startsWith("{") || str.startsWith("[")) {
        try { data[widget.id] = JSON.parse(str); return; } catch { /* usar como string */ }
      }
      data[widget.id] = str;
    });

    addSubmission({ formId, folderId, data: data as Record<string, string> });

    const folder = folders.find((f) => f.id === folderId);
    const formConfig = folder?.forms.find((fm) => fm.id === formId);
    const template = formConfig?.emailTemplate;

    if (template?.enabled) {
      setEmailStatus("sending");
      try {
        const labeledData: Record<string, string> = {};
        widgets.forEach((widget) => {
          if (!hiddenWidgetIds.has(widget.id)) {
            const key = widget.label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "");
            const val = data[widget.id];
            labeledData[key] = val == null ? "" : typeof val === "string" ? val : JSON.stringify(val);
          }
        });

        const attachments: Array<{ name: string; contentType: string; contentBytes: string }> = [];

        // Generar HTML del Excel para que Puppeteer en el servidor lo convierta a PDF
        let excelHtml: string | undefined;
        if (template.attachPDF && template.excelBase64 && template.excelMappings?.length) {
          const html = generateExcelHtml(
            template.excelBase64,
            template.excelMappings,
            labeledData,
            template.excelLogoBase64,
          );
          if (html) excelHtml = html;
        }

        await sendFormEmail({
          template,
          formData: labeledData,
          users,
          currentUser: currentUser ?? undefined,
          attachments,
          excelHtml,
        });
        setEmailStatus("sent");
      } catch (err) {
        console.error("Error enviando email:", err);
        setEmailStatus("error");
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
    formRef.current?.reset();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      {!isPublic && (
        <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📋</span>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>{formName}</h1>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Diligenciar formulario</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ padding: "7px 14px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Volver</button>
          )}
        </header>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ background: "#ffffff", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", padding: "28px 24px" }}>
            <div style={{ borderBottom: "2px solid #00c2a8", paddingBottom: 18, marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{formName}</h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Completa todos los campos marcados con <span style={{ color: "#ef4444" }}>*</span> y envía el formulario.</p>
            </div>

            {widgets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "2px dashed #e2e8f0", borderRadius: 12, color: "#9ca3af" }}>
                <span style={{ fontSize: 48 }}>📋</span>
                <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600 }}>Este formulario no tiene campos</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit}
                onChange={() => {
                  const fd = new FormData(formRef.current!);
                  const values: Record<string, string> = {};
                  widgets.forEach((w) => { values[w.id] = String(fd.get(w.id) ?? ""); });
                  setFieldValues(values);
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {widgets.map((widget) => {
                    const RenderComponent = widgetRegistry[widget.type]?.render;
                    const isHidden = hiddenWidgetIds.has(widget.id);
                    if (!RenderComponent) return null;
                    return (
                      <div key={widget.id} style={{
                        overflow: "hidden", maxHeight: isHidden ? 0 : 600, opacity: isHidden ? 0 : 1,
                        padding: isHidden ? "0 16px" : "16px", marginBottom: isHidden ? -18 : 0,
                        background: "#f9fafb", borderRadius: 10, border: isHidden ? "none" : "1px solid #e5e7eb",
                        transition: "max-height 0.25s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease",
                        pointerEvents: isHidden ? "none" : "auto",
                      }}>
                        <RenderComponent widget={widget} />
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  {onClose && (
                    <button type="button" onClick={onClose} style={{ padding: "10px 24px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  )}
                  <button type="submit" disabled={submitting} style={{
                    padding: "10px 28px", background: submitting ? "#94a3b8" : "#00c2a8", color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
                    boxShadow: submitting ? "none" : "0 2px 8px rgba(0,194,168,0.3)", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                  }}>
                    {submitting ? (
                      <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Enviando...</>
                    ) : "📤 Enviar formulario"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {missingFields.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "40px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 72, height: 72, margin: "0 auto 20px", background: "linear-gradient(135deg, #ef4444, #dc2626)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 36 }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>Campos obligatorios faltantes</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px", lineHeight: 1.6 }}>Por favor completa los siguientes campos:</p>
            <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "14px 18px", marginBottom: 20, textAlign: "left" }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#991b1b", lineHeight: 1.8 }}>
                {missingFields.map((f, i) => <li key={i} style={{ fontWeight: 600 }}>{f}</li>)}
              </ul>
            </div>
            <button onClick={() => setMissingFields([])} style={{ padding: "11px 32px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Entendido</button>
          </div>
        </div>
      )}

      {showSuccess && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 24px", background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(16,185,129,0.4)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>¡Registro guardado!</h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>El formulario fue enviado correctamente.</p>
            {emailStatus === "sending" && <div style={{ padding: "8px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af", marginBottom: 16 }}>📧 Enviando notificación por email...</div>}
            {emailStatus === "sent" && <div style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534", marginBottom: 16 }}>✅ Notificación enviada correctamente</div>}
            {emailStatus === "error" && <div style={{ padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#991b1b", marginBottom: 16 }}>⚠️ El registro se guardó pero el email no pudo enviarse</div>}
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button onClick={handleCloseSuccess} style={{ padding: "12px 32px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(0,194,168,0.3)" }}>📋 Diligenciar otro registro</button>
              {onClose && <button onClick={onClose} style={{ padding: "11px 32px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Volver</button>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}