import { useState, useEffect, useRef } from "react";
import RichTextEditor from "./RichTextEditor";
import PdfMapper from "./PdfMapper";
import ExcelMapper from "./ExcelMapper";
import ExcelPreview from "./ExcelPreview";
import type { EmailTemplate, EmailRecipient } from "../../types/email-template.types";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";
import { useUsersStore } from "../../store/useUsersStore";
import { ROLE_LABELS } from "../../types/auth.types";

type EmailConfigPanelProps = { folderId?: string; formId?: string; onClose: () => void };

const AVAILABLE_GROUPS = [
  { id: "current_user", label: "Quien diligencia", icon: "✍️", color: "#00c2a8" },
  { id: "admin",        label: "Administradores",  icon: "👨‍💼", color: "#7c3aed" },
  { id: "coordinator",  label: "Coordinadores",    icon: "👩‍⚕️", color: "#0891b2" },
  { id: "user",         label: "Usuarios",         icon: "👤", color: "#d97706" },
];

function RecipientsInput({ label, recipients, onChange, allUsers, hasError }: {
  label: string; recipients: EmailRecipient[]; onChange: (r: EmailRecipient[]) => void;
  allUsers: Array<{ id: number; email: string; name: string; role: string; active: boolean }>; hasError?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = inputValue.trim().toLowerCase();
  const alreadyGroupIds = recipients.filter(r => r.type === "group").map(r => r.group);
  const alreadyEmails = recipients.filter(r => r.type === "static").map(r => r.email);
  const groupSuggestions = AVAILABLE_GROUPS.filter(g => !alreadyGroupIds.includes(g.id) && (query === "" || g.label.toLowerCase().includes(query)));
  const userSuggestions = allUsers.filter(u => u.active && !alreadyEmails.includes(u.email) && query.length >= 2 && (u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)));
  const hasDropdown = showDropdown && (groupSuggestions.length > 0 || userSuggestions.length > 0);
  const addGroup = (group: typeof AVAILABLE_GROUPS[0]) => { onChange([...recipients, { id: crypto.randomUUID(), type: "group", group: group.id, groupLabel: group.label }]); setInputValue(""); inputRef.current?.focus(); };
  const addStatic = (email: string) => { if (!email.includes("@")) return; onChange([...recipients, { id: crypto.randomUUID(), type: "static", email }]); setInputValue(""); inputRef.current?.focus(); };
  const remove = (id: string) => onChange(recipients.filter(r => r.id !== id));
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) { e.preventDefault(); addStatic(inputValue.trim().replace(/,$/, "")); }
    if (e.key === "Backspace" && inputValue === "" && recipients.length > 0) remove(recipients[recipients.length - 1].id);
  };
  const tagColor = (r: EmailRecipient) => r.type === "group" ? (AVAILABLE_GROUPS.find(g => g.id === r.group)?.color ?? "#6b7280") : "#374151";
  const tagBg = (r: EmailRecipient) => r.type === "group" ? `${AVAILABLE_GROUPS.find(g => g.id === r.group)?.color ?? "#6b7280"}18` : "#f3f4f6";
  const tagIcon = (r: EmailRecipient) => r.type === "group" ? (AVAILABLE_GROUPS.find(g => g.id === r.group)?.icon ?? "👥") : "✉️";
  const tagLabel = (r: EmailRecipient) => r.type === "group" ? (r.groupLabel ?? r.group ?? "") : (r.email ?? "");

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: hasError ? "#dc2626" : "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {label} {hasError && <span style={{ color: "#dc2626" }}>— Requerido</span>}
      </label>
      <div style={{ minHeight: 42, padding: "6px 10px", border: `1.5px solid ${hasError ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 8, background: hasError ? "#fef2f2" : "#fff", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", cursor: "text", position: "relative" }}
        onClick={() => { inputRef.current?.focus(); setShowDropdown(true); }}>
        {recipients.map(r => (
          <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: tagBg(r), border: `1.5px solid ${tagColor(r)}33`, fontSize: 12, fontWeight: 600, color: tagColor(r) }}>
            <span style={{ fontSize: 13 }}>{tagIcon(r)}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{tagLabel(r)}</span>
            <button type="button" onClick={e => { e.stopPropagation(); remove(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: tagColor(r), padding: 0, fontSize: 13, lineHeight: 1, marginLeft: 2 }}>×</button>
          </span>
        ))}
        <input ref={inputRef} value={inputValue} onChange={e => { setInputValue(e.target.value); setShowDropdown(true); }} onKeyDown={handleKeyDown} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={recipients.length === 0 ? "Escribe un correo, busca usuario o selecciona un grupo..." : ""} style={{ flex: 1, minWidth: 180, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111827" }} />
        {hasDropdown && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 280, overflowY: "auto" }}>
            {groupSuggestions.length > 0 && (<>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>GRUPOS</div>
              {groupSuggestions.map(g => (
                <div key={g.id} onMouseDown={() => addGroup(g)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", borderLeft: `3px solid ${g.color}` }} onMouseOver={e => { e.currentTarget.style.background = "#f8fafc"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 18 }}>{g.icon}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{g.id === "current_user" ? "Email del usuario que diligencia" : `Todos los ${g.label.toLowerCase()}`}</div></div>
                  <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${g.color}18`, color: g.color, fontWeight: 700 }}>GRUPO</span>
                </div>
              ))}
            </>)}
            {userSuggestions.length > 0 && (<>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", borderTop: groupSuggestions.length > 0 ? "1px solid #f1f5f9" : "none" }}>USUARIOS</div>
              {userSuggestions.map(u => (
                <div key={u.id} onMouseDown={() => addStatic(u.email)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer" }} onMouseOver={e => { e.currentTarget.style.background = "#f8fafc"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #00c2a8, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700 }}>{u.name.charAt(0).toUpperCase()}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email} · {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</div></div>
                </div>
              ))}
            </>)}
            {query.includes("@") && !alreadyEmails.includes(query) && (
              <div onMouseDown={() => addStatic(query)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", borderTop: "1px solid #f1f5f9" }} onMouseOver={e => { e.currentTarget.style.background = "#f8fafc"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 18 }}>✉️</span>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Agregar "{query}"</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Destinatario estático</div></div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Escribe un correo y presiona Enter · Busca usuarios por nombre · Selecciona grupos del menú</div>
    </div>
  );
}

// ── Panel de placeholders inline ──────────────────────────────────────────────
// Usa onMouseDown + preventDefault para NO perder el foco/selección del editor
function PlaceholderPanel({ placeholders, onInsert }: {
  placeholders: Array<{ placeholder: string; description: string }>;
  onInsert: (p: string) => void;
}) {
  if (placeholders.length === 0) return (
    <div style={{ padding: "10px 14px", background: "#f9fafb", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
      No hay campos en el formulario aún
    </div>
  );
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>
        📋 Campos disponibles — clic para insertar donde está el cursor
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {placeholders.map((p, i) => (
          <button key={i} type="button"
            onMouseDown={e => {
              // preventDefault evita que el editor pierda el foco antes de insertar
              e.preventDefault();
              onInsert(p.placeholder);
            }}
            style={{ padding: "5px 10px", background: "#fff", border: "1.5px solid #00c2a8", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "monospace", color: "#0f766e", fontWeight: 600, transition: "all 0.15s" }}
            onMouseOver={e => { e.currentTarget.style.background = "#e6faf7"; }}
            onMouseOut={e => { e.currentTarget.style.background = "#fff"; }}
            title={`Insertar: ${p.description}`}>
            {p.placeholder}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function EmailConfigPanel({ folderId, formId, onClose }: EmailConfigPanelProps) {
  const widgets = useBuilderStore(s => s.widgets);
  const { folders, updateFormEmailTemplate } = useFolderStore();
  const { users } = useUsersStore();
  const hasLoadedRef = useRef(false);

  const [config, setConfig] = useState<EmailTemplate>({
    enabled: false, subject: "", to: "", cc: "", bcc: "", replyTo: "",
    emailBody: "", attachPDF: true, pdfTemplate: "", pdfFilename: "formulario.pdf",
    toRecipients: [], ccRecipients: [], bccRecipients: [], senderName: "",
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showEmailCodeMode, setShowEmailCodeMode] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [pdfMode, setPdfMode] = useState<"html" | "upload" | "excel">("html");
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [showPdfMapper, setShowPdfMapper] = useState(false);
  const [showExcelMapper, setShowExcelMapper] = useState(false);
  const [uploadedExcelFile, setUploadedExcelFile] = useState<File | null>(null);

  // Refs para insertar placeholders
  const pdfTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emailBodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Guarda el Range del contenteditable antes de que el botón lo robe
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!folderId || !formId || hasLoadedRef.current) return;
    const folder = folders.find(f => f.id === folderId);
    const form = folder?.forms.find(fm => fm.id === formId);
    if (form?.emailTemplate) {
      setTimeout(() => {
        if (form.emailTemplate) {
          const tmpl = form.emailTemplate;
          setConfig({ ...tmpl, toRecipients: tmpl.toRecipients ?? [], ccRecipients: tmpl.ccRecipients ?? [], bccRecipients: tmpl.bccRecipients ?? [] });
          if ((tmpl.ccRecipients?.length ?? 0) > 0 || (tmpl.bccRecipients?.length ?? 0) > 0) setShowCcBcc(true);
          hasLoadedRef.current = true;
        }
      }, 0);
    }
  }, [folderId, formId, folders]);

  const widgetPlaceholders = widgets.map(w => ({
    placeholder: `\${${w.label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "")}}`,
    description: w.label, widgetType: w.type,
  }));

  // Insertar placeholder en textarea con posición de cursor
  const insertIntoTextarea = (ref: React.MutableRefObject<HTMLTextAreaElement | null>, field: "emailBody" | "pdfTemplate", placeholder: string) => {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config[field];
    const newText = text.substring(0, start) + placeholder + text.substring(end);
    setConfig(prev => ({ ...prev, [field]: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Insertar en RichTextEditor (emailBody en modo visual)
  // onMouseDown en PlaceholderPanel previene pérdida de foco,
  // por eso la selección sigue activa cuando llegamos aquí.
  // savedRangeRef es el fallback por si acaso.
  const insertIntoRichEditor = (placeholder: string) => {
    const sel = window.getSelection();

    // Intentar con la selección activa primero
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      const candidate = sel.getRangeAt(0);
      const ancestor = candidate.commonAncestorContainer;
      const parent = ancestor.nodeType === 1 ? ancestor as Element : (ancestor as Text).parentElement;
      if (parent?.closest("[contenteditable]")) {
        range = candidate;
      }
    }
    // Fallback: usar el range guardado
    if (!range && savedRangeRef.current) {
      range = savedRangeRef.current;
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    if (range) {
      const editorEl = (range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer as Element
        : (range.commonAncestorContainer as Text).parentElement
      )?.closest("[contenteditable]") as HTMLElement | null;

      if (editorEl) {
        range.deleteContents();
        const textNode = document.createTextNode(placeholder);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();
        editorEl.dispatchEvent(new Event("input", { bubbles: true }));
        setConfig(prev => ({ ...prev, emailBody: editorEl.innerHTML }));
        return;
      }
    }
    // Fallback final: append al final
    setConfig(prev => ({ ...prev, emailBody: prev.emailBody + placeholder }));
  };

  const handleSave = () => {
    if (!folderId || !formId) return;
    if (config.enabled) {
      const errors: string[] = [];
      if ((config.toRecipients?.length ?? 0) === 0) errors.push("Debes agregar al menos un destinatario en Para (To)");
      if (!config.subject?.trim()) errors.push("El asunto no puede estar vacío");
      if (!config.emailBody?.trim()) errors.push("El cuerpo del email no puede estar vacío");
      if (errors.length > 0) { setValidationErrors(errors); return; }
    }
    setValidationErrors([]);
    updateFormEmailTemplate(folderId, formId, config);
    onClose();
  };

  const loadTemplateEmail = () => {
    const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #00c2a8; color: white; padding: 24px; text-align: center; }
    .content { padding: 24px; color: #374151; line-height: 1.6; }
    .footer { text-align: center; padding: 16px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; }
    @media (max-width: 600px) { body { padding: 8px; } .content { padding: 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;font-size:22px">Nuevo Registro Recibido</h1></div>
    <div class="content">
      <p>Hola,</p>
      <p>Se ha recibido un nuevo registro. Los detalles están en el PDF adjunto.</p>
      <p>Gracias por tu atención.</p>
    </div>
    <div class="footer"><p>Este email fue generado automáticamente por SoulForms</p></div>
  </div>
</body>
</html>`;
    setConfig(prev => ({ ...prev, emailBody: template }));
  };

  const loadTemplatePdf = () => {
    const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; }
    .header { background: #00c2a8; color: white; padding: 16px; border-radius: 8px 8px 0 0; text-align: center; margin: -24px -24px 24px; }
    .field { margin-bottom: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #00c2a8; border-radius: 0 6px 6px 0; }
    .field-label { font-weight: bold; color: #374151; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
    .field-value { color: #111827; font-size: 14px; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;font-size:20px">Formulario Completado</h1></div>
${widgets.map(w => `    <div class="field">
      <div class="field-label">${w.label}</div>
      <div class="field-value">\${${w.label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "")}}</div>
    </div>`).join("\n")}
    <div class="footer"><p>Documento generado por SoulForms</p></div>
  </div>
</body>
</html>`;
    setConfig(prev => ({ ...prev, pdfTemplate: template }));
  };

  const renderEmailPreview = () => { let html = config.emailBody; widgetPlaceholders.forEach(p => { html = html.replace(new RegExp(p.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `[Ejemplo: ${p.description}]`); }); return html; };
  const renderPdfPreview = () => { let html = config.pdfTemplate; widgetPlaceholders.forEach(p => { html = html.replace(new RegExp(p.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `[Ejemplo: ${p.description}]`); }); return html; };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedPdfFile(file);
      const reader = new FileReader();
      reader.onload = () => setConfig(prev => ({ ...prev, pdfBase64: reader.result as string, pdfMappings: [] }));
      reader.readAsDataURL(file);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel")) {
      setUploadedExcelFile(file);
      const reader = new FileReader();
      reader.onload = () => setConfig(prev => ({ ...prev, excelBase64: reader.result as string, excelMappings: [], excelFilename: file.name }));
      reader.readAsDataURL(file);
    }
  };

  const btnBase: React.CSSProperties = { padding: "4px 12px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };
  const inputErrorStyle: React.CSSProperties = { ...inputStyle, border: "1.5px solid #fca5a5", background: "#fef2f2" };
  const hasSubjectError = validationErrors.some(e => e.includes("asunto"));
  const hasBodyError = validationErrors.some(e => e.includes("cuerpo"));
  const hasToError = validationErrors.some(e => e.includes("destinatario"));
  const totalTo = config.toRecipients?.length ?? 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 1000, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>📧 Configuración de Email</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Configura el email que se enviará al completar el formulario</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

          {/* Toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: 16, background: config.enabled ? "#e6faf7" : "#f9fafb", border: `2px solid ${config.enabled ? "#00c2a8" : "#e2e8f0"}`, borderRadius: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={config.enabled} onChange={e => { setConfig(prev => ({ ...prev, enabled: e.target.checked })); setValidationErrors([]); }} style={{ width: 18, height: 18, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Activar notificación por email</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Se enviará un email automáticamente cuando alguien complete este formulario</div>
            </div>
          </label>

          {config.enabled && (<>
            {/* Remitente */}
            <div style={{ marginBottom: 20, padding: 20, background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>✍️</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Remitente</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre del remitente</label>
                  <input type="text" value={config.senderName ?? ""} onChange={e => setConfig(prev => ({ ...prev, senderName: e.target.value }))} placeholder="Ej: Grupo Soul - SoulForms" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Responder a (opcional)</label>
                  <input type="email" value={config.replyTo ?? ""} onChange={e => setConfig(prev => ({ ...prev, replyTo: e.target.value }))} placeholder="Ej: soporte@gruposoul.com" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Destinatarios */}
            <div style={{ marginBottom: 24, padding: 20, background: "#f8fafc", border: `2px solid ${hasToError ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>👥</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Destinatarios</h3>
                  {totalTo > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#e6faf7", color: "#00c2a8", fontWeight: 700 }}>{totalTo} en Para</span>}
                </div>
                <button type="button" onClick={() => setShowCcBcc(!showCcBcc)} style={{ fontSize: 12, color: "#0891b2", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  {showCcBcc ? "▲ Ocultar CC/BCC" : "▼ Mostrar CC/BCC"}
                </button>
              </div>
              <RecipientsInput label="Para (To) *" recipients={config.toRecipients ?? []} onChange={r => { setConfig(prev => ({ ...prev, toRecipients: r })); if (r.length > 0) setValidationErrors(prev => prev.filter(e => !e.includes("destinatario"))); }} allUsers={users} hasError={hasToError} />
              {showCcBcc && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
                  <RecipientsInput label="CC (opcional)" recipients={config.ccRecipients ?? []} onChange={r => setConfig(prev => ({ ...prev, ccRecipients: r }))} allUsers={users} />
                  <RecipientsInput label="BCC (opcional)" recipients={config.bccRecipients ?? []} onChange={r => setConfig(prev => ({ ...prev, bccRecipients: r }))} allUsers={users} />
                </div>
              )}
            </div>

            {/* Asunto */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: hasSubjectError ? "#dc2626" : "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                Asunto * {hasSubjectError && <span style={{ color: "#dc2626", fontWeight: 400 }}>— No puede estar vacío</span>}
              </label>
              <input type="text" value={config.subject} onChange={e => { setConfig(prev => ({ ...prev, subject: e.target.value })); if (e.target.value.trim()) setValidationErrors(prev => prev.filter(e => !e.includes("asunto"))); }} placeholder="Nuevo registro - Formulario" style={hasSubjectError ? inputErrorStyle : inputStyle} />
            </div>

            {/* ── Cuerpo del Email ── */}
            <div style={{ marginBottom: 24, padding: 20, background: "#f8fafc", border: `2px solid ${hasBodyError ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📧</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: hasBodyError ? "#dc2626" : "#111827", margin: 0 }}>
                    Cuerpo del Email {hasBodyError && <span style={{ fontSize: 12, fontWeight: 400, color: "#dc2626" }}>— Requerido</span>}
                  </h3>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={loadTemplateEmail} style={{ ...btnBase, background: "#3b82f6", color: "#fff" }}>📄 Cargar plantilla</button>
                  {config.emailBody && <button type="button" onClick={() => setConfig(prev => ({ ...prev, emailBody: "" }))} style={{ ...btnBase, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>🗑️ Borrar</button>}
                  <button type="button" onClick={() => setShowEmailPreview(true)} style={{ ...btnBase, background: "#8b5cf6", color: "#fff" }}>👁️ Preview</button>
                  <button type="button" onClick={() => setShowEmailCodeMode(!showEmailCodeMode)} style={{ ...btnBase, background: showEmailCodeMode ? "#10b981" : "#f59e0b", color: "#fff" }}>
                    {showEmailCodeMode ? "📝 Modo Visual" : "💻 Ver Código"}
                  </button>
                </div>
              </div>

              {/* Placeholders siempre visibles para emailBody */}
              <PlaceholderPanel
                placeholders={widgetPlaceholders}
                onInsert={p => {
                  if (showEmailCodeMode) insertIntoTextarea(emailBodyTextareaRef, "emailBody", p);
                  else insertIntoRichEditor(p);
                }}
              />

              {showEmailCodeMode ? (
                <textarea ref={emailBodyTextareaRef} id="emailBodyEditor" value={config.emailBody}
                  onChange={e => { setConfig(prev => ({ ...prev, emailBody: e.target.value })); if (e.target.value.trim()) setValidationErrors(prev => prev.filter(e => !e.includes("cuerpo"))); }}
                  placeholder="<h1>Hola</h1><p>Contenido del email...</p>"
                  style={{ width: "100%", minHeight: 250, padding: 12, border: `1.5px solid ${hasBodyError ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", background: "#1e293b", color: "#e2e8f0" }}
                />
              ) : (
                <div
                  onMouseUp={() => { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange(); }}
                  onKeyUp={() => { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange(); }}
                >
                  <RichTextEditor value={config.emailBody} onChange={html => { setConfig(prev => ({ ...prev, emailBody: html })); if (html.trim()) setValidationErrors(prev => prev.filter(e => !e.includes("cuerpo"))); }} placeholder="Escribe el contenido del email aquí..." />
                </div>
              )}
            </div>

            {/* ── PDF ── */}
            <div style={{ marginBottom: 24, padding: 20, background: "#fef3f2", border: "2px solid #fecaca", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Documento PDF Adjunto</h3>
                </div>
                <div style={{ display: "flex", gap: 4, background: "#fff", padding: 4, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  {(["html", "upload", "excel"] as const).map(mode => (
                    <button key={mode} type="button" onClick={() => setPdfMode(mode)}
                      style={{ padding: "6px 12px", background: pdfMode === mode ? "#dc2626" : "transparent", color: pdfMode === mode ? "#fff" : "#6b7280", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {mode === "html" ? "💻 HTML" : mode === "upload" ? "📤 PDF" : "📊 Excel"}
                    </button>
                  ))}
                </div>
              </div>

              {pdfMode === "html" && (<>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Este HTML se convertirá en PDF adjunto al email. Usa los placeholders para insertar datos del formulario.</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
                  <button type="button" onClick={loadTemplatePdf} style={{ ...btnBase, background: "#3b82f6", color: "#fff" }}>📄 Cargar plantilla</button>
                  {config.pdfTemplate && <button type="button" onClick={() => setConfig(prev => ({ ...prev, pdfTemplate: "" }))} style={{ ...btnBase, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>🗑️ Borrar plantilla</button>}
                  <button type="button" onClick={() => setShowPdfPreview(true)} style={{ ...btnBase, background: "#8b5cf6", color: "#fff" }}>👁️ Preview</button>
                </div>

                {/* Placeholders siempre visibles para pdfTemplate */}
                <PlaceholderPanel
                  placeholders={widgetPlaceholders}
                  onInsert={p => insertIntoTextarea(pdfTextareaRef, "pdfTemplate", p)}
                />

                <textarea ref={pdfTextareaRef} id="pdfTemplateEditor" value={config.pdfTemplate}
                  onChange={e => setConfig(prev => ({ ...prev, pdfTemplate: e.target.value }))}
                  placeholder="<table><tr><td>Nombre: ${nombre}</td></tr></table>"
                  style={{ width: "100%", minHeight: 280, padding: 12, border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", background: "#1e293b", color: "#e2e8f0" }}
                />
              </>)}

              {pdfMode === "upload" && (<>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Sube un archivo PDF que se adjuntará directamente al email</p>
                <div style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: 32, textAlign: "center", background: "#fff" }}>
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: "none" }} id="pdfUploadInput" />
                  {uploadedPdfFile ? (
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{uploadedPdfFile.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>{(uploadedPdfFile.size / 1024).toFixed(2)} KB</div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button type="button" onClick={() => document.getElementById("pdfUploadInput")?.click()} style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔄 Cambiar</button>
                        <button type="button" onClick={() => setShowPdfMapper(true)} disabled={!config.pdfBase64} style={{ padding: "8px 16px", background: config.pdfBase64 ? "#00c2a8" : "#e2e8f0", color: config.pdfBase64 ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: config.pdfBase64 ? "pointer" : "not-allowed" }}>📍 Mapear ({config.pdfMappings?.length || 0})</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                      <button type="button" onClick={() => document.getElementById("pdfUploadInput")?.click()} style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>📤 Seleccionar PDF</button>
                    </div>
                  )}
                </div>
              </>)}

              {pdfMode === "excel" && (<>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Carga un archivo Excel y mapea los campos a celdas específicas</p>
                <input type="file" id="excelUploadInput" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: "none" }} />
                <div style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: "30px 20px", textAlign: "center", background: "#f9fafb", marginBottom: 16 }}>
                  {config.excelBase64 ? (
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#00c2a8", marginBottom: 8 }}>✓ {config.excelFilename || uploadedExcelFile?.name}</div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => document.getElementById("excelUploadInput")?.click()} style={{ padding: "8px 16px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔄 Cambiar</button>
                        <button type="button" onClick={() => setShowExcelMapper(true)} style={{ padding: "8px 16px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📍 Mapear ({config.excelMappings?.length || 0})</button>
                        <button type="button" onClick={() => setShowExcelPreview(true)} style={{ padding: "8px 16px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>👁️ Preview</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                      <button type="button" onClick={() => document.getElementById("excelUploadInput")?.click()} style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>📊 Seleccionar Excel</button>
                    </div>
                  )}
                </div>
              </>)}
            </div>

            {/* Adjuntar PDF */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#f9fafb", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={config.attachPDF} onChange={e => setConfig(prev => ({ ...prev, attachPDF: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Adjuntar PDF al email</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Se generará el PDF y se adjuntará automáticamente</div>
              </div>
            </label>
            {config.attachPDF && (
              <div style={{ marginTop: 12, marginLeft: 26 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Nombre del archivo PDF</label>
                <input type="text" value={config.pdfFilename} onChange={e => setConfig(prev => ({ ...prev, pdfFilename: e.target.value }))} placeholder="formulario.pdf" style={{ width: 300, padding: "6px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
              </div>
            )}
          </>)}
        </div>

        {/* Errores */}
        {validationErrors.length > 0 && (
          <div style={{ margin: "0 24px 16px", padding: "12px 16px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>⚠️ Corrige los siguientes errores:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#991b1b", lineHeight: 1.8 }}>
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleSave} style={{ padding: "10px 24px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>💾 Guardar configuración</button>
        </div>

        {/* Modales internos */}
        {showEmailPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>📧 Preview - Email</h3>
                <button onClick={() => setShowEmailPreview(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}>
                <div dangerouslySetInnerHTML={{ __html: renderEmailPreview() }} style={{ background: "#fff", borderRadius: 8 }} />
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowEmailPreview(false)} style={{ padding: "10px 24px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
        {showPdfPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>📄 Preview - PDF</h3>
                <button onClick={() => setShowPdfPreview(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}>
                <div dangerouslySetInnerHTML={{ __html: renderPdfPreview() }} style={{ background: "#fff", borderRadius: 8 }} />
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowPdfPreview(false)} style={{ padding: "10px 24px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
        {showPdfMapper && config.pdfBase64 && (
          <PdfMapper pdfBase64={config.pdfBase64} existingMappings={config.pdfMappings || []} availablePlaceholders={widgetPlaceholders}
            onSave={mappings => { setConfig(prev => ({ ...prev, pdfMappings: mappings })); setShowPdfMapper(false); }} onClose={() => setShowPdfMapper(false)} />
        )}
        {showExcelMapper && config.excelBase64 && (
          <ExcelMapper excelBase64={config.excelBase64} existingMappings={config.excelMappings || []} availablePlaceholders={widgetPlaceholders}
            onSave={(mappings, logoBase64) => { setConfig(prev => ({ ...prev, excelMappings: mappings, ...(logoBase64 ? { excelLogoBase64: logoBase64 } : {}) })); setShowExcelMapper(false); }}
            onClose={() => setShowExcelMapper(false)} />
        )}
        {showExcelPreview && config.excelBase64 && (
          <ExcelPreview excelBase64={config.excelBase64} mappings={config.excelMappings || []} availablePlaceholders={widgetPlaceholders}
            customLogoBase64={config.excelLogoBase64} onClose={() => setShowExcelPreview(false)} />
        )}
      </div>
    </div>
  );
}