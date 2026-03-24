import { useState, useEffect, useRef } from "react";
import RichTextEditor from "./RichTextEditor";
import PdfMapper from "./PdfMapper";
import ExcelMapper from "./ExcelMapper";
import ExcelPreview from "./ExcelPreview";
import type { EmailTemplate } from "../../types/email-template.types";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";

type EmailConfigPanelProps = {
  folderId?: string;
  formId?: string;
  onClose: () => void;
};

export default function EmailConfigPanel({ folderId, formId, onClose }: EmailConfigPanelProps) {
  const widgets = useBuilderStore((s) => s.widgets);
  const { folders, updateFormEmailTemplate } = useFolderStore();
  const hasLoadedRef = useRef(false);

  const [config, setConfig] = useState<EmailTemplate>({
    enabled: false,
    subject: "",
    to: "",
    cc: "",
    bcc: "",
    replyTo: "",
    emailBody: "",
    attachPDF: true,
    pdfTemplate: "",
    pdfFilename: "formulario.pdf",
  });

  const [showPlaceholdersEmail, setShowPlaceholdersEmail] = useState(false);
  const [showPlaceholdersPdf, setShowPlaceholdersPdf] = useState(false);
  const [showEmailCodeMode, setShowEmailCodeMode] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false); // ← NUEVO
  const [pdfMode, setPdfMode] = useState<"html" | "upload" | "excel">("html");
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [showPdfMapper, setShowPdfMapper] = useState(false);
  const [showExcelMapper, setShowExcelMapper] = useState(false);
  const [uploadedExcelFile, setUploadedExcelFile] = useState<File | null>(null);

  // Cargar configuración existente
  useEffect(() => {
    if (!folderId || !formId || hasLoadedRef.current) return;
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (form?.emailTemplate) {
      setTimeout(() => {
        if (form.emailTemplate) {
          setConfig(form.emailTemplate);
          hasLoadedRef.current = true;
        }
      }, 0);
    }
  }, [folderId, formId, folders]);

  // Placeholders basados en los widgets
  const widgetPlaceholders = widgets.map((w) => ({
    placeholder: `\${${w.label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "")}}`,
    description: w.label,
    widgetType: w.type,
  }));

  const insertPlaceholder = (placeholder: string, targetField: "emailBody" | "pdfTemplate") => {
    const textareaId = targetField === "emailBody" ? "emailBodyEditor" : "pdfTemplateEditor";
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config[targetField];
    const before = text.substring(0, start);
    const after = text.substring(end);
    setConfig({ ...config, [targetField]: before + placeholder + after });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const handleSave = () => {
    if (!folderId || !formId) {
      alert("Error: No se puede guardar sin folderId y formId");
      return;
    }
    updateFormEmailTemplate(folderId, formId, config);
    onClose();
  };

  const loadTemplateEmail = () => {
    const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; }
    .header { background: #00c2a8; color: white; padding: 16px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px 0; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin: 0;">Nuevo Registro Recibido</h1></div>
    <div class="content">
      <p>Hola,</p>
      <p>Se ha recibido un nuevo registro en el formulario. Los detalles están en el PDF adjunto.</p>
      <p>Gracias por tu atención.</p>
    </div>
    <div class="footer"><p>Este email fue generado automáticamente por SoulForms</p></div>
  </div>
</body>
</html>`;
    setConfig({ ...config, emailBody: template });
  };

  const loadTemplatePdf = () => {
    const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; }
    .header { background: #00c2a8; color: white; padding: 16px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 20px 0; }
    .field { margin-bottom: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #00c2a8; }
    .field-label { font-weight: bold; color: #374151; margin-bottom: 4px; }
    .field-value { color: #111827; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin: 0;">Formulario Completado</h1></div>
    <div class="content">
      <p>Información del registro:</p>
      ${widgets
        .map(
          (w) => `
      <div class="field">
        <div class="field-label">${w.label}</div>
        <div class="field-value">\${${w.label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "")}}</div>
      </div>`
        )
        .join("\n")}
    </div>
    <div class="footer"><p>Documento generado por SoulForms</p></div>
  </div>
</body>
</html>`;
    setConfig({ ...config, pdfTemplate: template });
  };

  const renderEmailPreview = () => {
    let html = config.emailBody;
    widgetPlaceholders.forEach((p) => {
      const exampleValue = `[Ejemplo: ${p.description}]`;
      html = html.replace(new RegExp(p.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), exampleValue);
    });
    return html;
  };

  const renderPdfPreview = () => {
    let html = config.pdfTemplate;
    widgetPlaceholders.forEach((p) => {
      const exampleValue = `[Ejemplo: ${p.description}]`;
      html = html.replace(new RegExp(p.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), exampleValue);
    });
    return html;
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedPdfFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setConfig({ ...config, pdfBase64: reader.result as string, pdfMappings: [] });
      };
      reader.readAsDataURL(file);
    } else {
      alert("Por favor selecciona un archivo PDF válido");
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (
      file &&
      (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel")
    ) {
      setUploadedExcelFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setConfig({
          ...config,
          excelBase64: reader.result as string,
          excelMappings: [],
          excelFilename: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert("Por favor selecciona un archivo Excel válido (.xlsx o .xls)");
    }
  };

  // ─── Estilos reutilizables ────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    padding: "4px 12px",
    border: "none",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        width: "100%", maxWidth: 1000, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
              📧 Configuración de Email
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Configura el email y el documento PDF adjunto que se enviará al completar el formulario
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer", padding: 4 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Toggle activar email */}
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 24, padding: 16,
            background: config.enabled ? "#e6faf7" : "#f9fafb",
            border: `2px solid ${config.enabled ? "#00c2a8" : "#e2e8f0"}`,
            borderRadius: 10, cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Activar notificación por email</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Se enviará un email automáticamente cuando alguien complete este formulario
              </div>
            </div>
          </label>

          {config.enabled && (
            <>
              {/* Para */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Para (To) *</label>
                <input type="email" value={config.to} onChange={(e) => setConfig({ ...config, to: e.target.value })} placeholder="destinatario@ejemplo.com" style={inputStyle} />
              </div>

              {/* CC / BCC */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>CC (opcional)</label>
                  <input type="email" value={config.cc} onChange={(e) => setConfig({ ...config, cc: e.target.value })} placeholder="cc@ejemplo.com" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>BCC (opcional)</label>
                  <input type="email" value={config.bcc} onChange={(e) => setConfig({ ...config, bcc: e.target.value })} placeholder="bcc@ejemplo.com" style={inputStyle} />
                </div>
              </div>

              {/* Asunto */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Asunto *</label>
                <input type="text" value={config.subject} onChange={(e) => setConfig({ ...config, subject: e.target.value })} placeholder="Nuevo registro - Formulario" style={inputStyle} />
              </div>

              {/* ── SECCIÓN 1: Cuerpo del Email ── */}
              <div style={{ marginBottom: 24, padding: 20, background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>📧</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Cuerpo del Email (HTML)</h3>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                  Este contenido aparecerá en el cuerpo del email que reciba el destinatario
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
                  <button type="button" onClick={loadTemplateEmail} style={{ ...btnBase, background: "#3b82f6", color: "#fff" }}>📄 Cargar plantilla</button>
                  <button type="button" onClick={() => setShowEmailPreview(true)} style={{ ...btnBase, background: "#8b5cf6", color: "#fff" }}>👁️ Ver Preview</button>
                  <button type="button" onClick={() => setShowEmailCodeMode(!showEmailCodeMode)} style={{ ...btnBase, background: showEmailCodeMode ? "#10b981" : "#f59e0b", color: "#fff" }}>
                    {showEmailCodeMode ? "📝 Modo Visual" : "💻 Ver Código"}
                  </button>
                  <button type="button" onClick={() => setShowPlaceholdersEmail(!showPlaceholdersEmail)} style={{ ...btnBase, background: "#e6faf7", color: "#00c2a8", border: "1px solid #00c2a8" }}>
                    📋 {showPlaceholdersEmail ? "Ocultar" : "Ver"} Placeholders
                  </button>
                </div>

                {showPlaceholdersEmail && (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 8, maxHeight: 180, overflowY: "auto" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>CAMPOS DEL FORMULARIO (clic para insertar)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                      {widgetPlaceholders.map((p, i) => (
                        <button key={i} type="button" onClick={() => insertPlaceholder(p.placeholder, "emailBody")}
                          style={{ padding: "6px 10px", background: "#f9fafb", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, textAlign: "left", cursor: "pointer", fontFamily: "monospace" }}>
                          {p.placeholder} <span style={{ color: "#9ca3af" }}>({p.description})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showEmailCodeMode ? (
                  <textarea id="emailBodyEditor" value={config.emailBody} onChange={(e) => setConfig({ ...config, emailBody: e.target.value })}
                    placeholder="<h1>Hola</h1><p>Contenido del email...</p>"
                    style={{ width: "100%", minHeight: 250, padding: 12, border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", background: "#1e293b", color: "#e2e8f0" }}
                  />
                ) : (
                  <RichTextEditor value={config.emailBody} onChange={(html) => setConfig({ ...config, emailBody: html })} placeholder="Escribe el contenido del email aquí..." />
                )}
              </div>

              {/* ── SECCIÓN 2: Documento PDF ── */}
              <div style={{ marginBottom: 24, padding: 20, background: "#fef3f2", border: "2px solid #fecaca", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Documento PDF Adjunto</h3>
                  </div>
                  {/* Selector de modo */}
                  <div style={{ display: "flex", gap: 4, background: "#fff", padding: 4, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    {(["html", "upload", "excel"] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => setPdfMode(mode)}
                        style={{ padding: "6px 12px", background: pdfMode === mode ? "#dc2626" : "transparent", color: pdfMode === mode ? "#fff" : "#6b7280", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                        {mode === "html" ? "💻 HTML" : mode === "upload" ? "📤 Cargar PDF" : "📊 Cargar Excel"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Modo HTML ── */}
                {pdfMode === "html" && (
                  <>
                    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Este HTML se convertirá en un documento PDF que se adjuntará al email</p>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
                      <button type="button" onClick={loadTemplatePdf} style={{ ...btnBase, background: "#3b82f6", color: "#fff" }}>📄 Cargar plantilla</button>
                      <button type="button" onClick={() => setShowPdfPreview(true)} style={{ ...btnBase, background: "#8b5cf6", color: "#fff" }}>👁️ Ver Preview PDF</button>
                      <button type="button" onClick={() => setShowPlaceholdersPdf(!showPlaceholdersPdf)} style={{ ...btnBase, background: "#e6faf7", color: "#00c2a8", border: "1px solid #00c2a8" }}>
                        📋 {showPlaceholdersPdf ? "Ocultar" : "Ver"} Placeholders
                      </button>
                    </div>
                    {showPlaceholdersPdf && (
                      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 8, maxHeight: 180, overflowY: "auto" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>CAMPOS DEL FORMULARIO (clic para insertar)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                          {widgetPlaceholders.map((p, i) => (
                            <button key={i} type="button" onClick={() => insertPlaceholder(p.placeholder, "pdfTemplate")}
                              style={{ padding: "6px 10px", background: "#f9fafb", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, textAlign: "left", cursor: "pointer", fontFamily: "monospace" }}>
                              {p.placeholder} <span style={{ color: "#9ca3af" }}>({p.description})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea id="pdfTemplateEditor" value={config.pdfTemplate} onChange={(e) => setConfig({ ...config, pdfTemplate: e.target.value })}
                      placeholder="<table><tr><td>Nombre: ${nombre}</td></tr></table>"
                      style={{ width: "100%", minHeight: 250, padding: 12, border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical" }}
                    />
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 8, fontWeight: 500 }}>💡 Tip: Puedes pegar aquí código HTML de tu formato</div>
                  </>
                )}

                {/* ── Modo Upload PDF ── */}
                {pdfMode === "upload" && (
                  <>
                    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Sube un archivo PDF que se adjuntará directamente al email (sin conversión)</p>
                    <div style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: 32, textAlign: "center", background: "#fff" }}>
                      <input type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: "none" }} id="pdfUploadInput" />
                      {uploadedPdfFile ? (
                        <div>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{uploadedPdfFile.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>{(uploadedPdfFile.size / 1024).toFixed(2)} KB</div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <button type="button" onClick={() => document.getElementById("pdfUploadInput")?.click()}
                              style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              🔄 Cambiar archivo
                            </button>
                            <button type="button" onClick={() => setShowPdfMapper(true)} disabled={!config.pdfBase64}
                              style={{ padding: "8px 16px", background: config.pdfBase64 ? "#00c2a8" : "#e2e8f0", color: config.pdfBase64 ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: config.pdfBase64 ? "pointer" : "not-allowed" }}>
                              📍 Mapear Campos ({config.pdfMappings?.length || 0})
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Arrastra tu PDF aquí o haz clic para seleccionar</div>
                          <button type="button" onClick={() => document.getElementById("pdfUploadInput")?.click()}
                            style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>
                            📤 Seleccionar PDF
                          </button>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>Formato: PDF | Tamaño máximo: 10 MB</div>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 12, fontWeight: 500 }}>💡 Este PDF se adjuntará directamente sin modificaciones</div>
                  </>
                )}

                {/* ── Modo Excel ── */}
                {pdfMode === "excel" && (
                  <>
                    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                      Carga un archivo Excel (.xlsx) y mapea los campos del formulario a celdas específicas
                    </p>
                    <input type="file" id="excelUploadInput" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: "none" }} />

                    <div style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: "30px 20px", textAlign: "center", background: "#f9fafb", marginBottom: 16 }}>
                      {config.excelBase64 ? (
                        <div>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#00c2a8", marginBottom: 8 }}>
                            ✓ Excel cargado: {config.excelFilename || uploadedExcelFile?.name}
                          </div>
                          {/* Mappings badge */}
                          {(config.excelMappings?.length ?? 0) > 0 && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                              <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>
                                ✅ {config.excelMappings!.length} campo{config.excelMappings!.length !== 1 ? "s" : ""} mapeado{config.excelMappings!.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => document.getElementById("excelUploadInput")?.click()}
                              style={{ padding: "8px 16px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              🔄 Cambiar archivo
                            </button>
                            <button type="button" onClick={() => setShowExcelMapper(true)} disabled={!config.excelBase64}
                              style={{ padding: "8px 16px", background: config.excelBase64 ? "#00c2a8" : "#e2e8f0", color: config.excelBase64 ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: config.excelBase64 ? "pointer" : "not-allowed" }}>
                              📍 Mapear Campos ({config.excelMappings?.length || 0})
                            </button>
                            {/* ← BOTÓN NUEVO: Ver Preview */}
                            <button type="button"
                              onClick={() => setShowExcelPreview(true)}
                              disabled={!config.excelBase64}
                              style={{
                                padding: "8px 16px",
                                background: config.excelBase64 ? "#8b5cf6" : "#e2e8f0",
                                color: config.excelBase64 ? "#fff" : "#9ca3af",
                                border: "none", borderRadius: 8,
                                fontSize: 13, fontWeight: 600,
                                cursor: config.excelBase64 ? "pointer" : "not-allowed",
                                boxShadow: config.excelBase64 ? "0 2px 6px rgba(139,92,246,0.3)" : "none",
                              }}
                            >
                              👁️ Ver Preview PDF
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Arrastra tu Excel aquí o haz clic para seleccionar</div>
                          <button type="button" onClick={() => document.getElementById("excelUploadInput")?.click()}
                            style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>
                            📊 Seleccionar Excel
                          </button>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>Formato: XLSX, XLS | Tamaño máximo: 10 MB</div>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 12, fontWeight: 500 }}>
                      💡 El Excel se llenará con los datos del formulario en las celdas que mapees
                    </div>
                  </>
                )}
              </div>

              {/* Adjuntar PDF */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#f9fafb", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={config.attachPDF} onChange={(e) => setConfig({ ...config, attachPDF: e.target.checked })} style={{ width: 16, height: 16, cursor: "pointer" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Adjuntar PDF al email</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Si está activado, se generará el PDF y se adjuntará al email automáticamente</div>
                </div>
              </label>

              {config.attachPDF && (
                <div style={{ marginTop: 12, marginLeft: 26 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Nombre del archivo PDF</label>
                  <input type="text" value={config.pdfFilename} onChange={(e) => setConfig({ ...config, pdfFilename: e.target.value })} placeholder="formulario.pdf"
                    style={{ width: 300, padding: "6px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ padding: "10px 24px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,194,168,0.3)" }}>
            💾 Guardar configuración
          </button>
        </div>

        {/* ── Modal Preview Email ── */}
        {showEmailPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>📧 Preview - Cuerpo del Email</h3>
                <button onClick={() => setShowEmailPreview(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}>
                <div dangerouslySetInnerHTML={{ __html: renderEmailPreview() }} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowEmailPreview(false)} style={{ padding: "10px 24px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Preview PDF (HTML) ── */}
        {showPdfPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>📄 Preview - Documento PDF</h3>
                <button onClick={() => setShowPdfPreview(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}>
                <div dangerouslySetInnerHTML={{ __html: renderPdfPreview() }} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowPdfPreview(false)} style={{ padding: "10px 24px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal PdfMapper ── */}
        {showPdfMapper && config.pdfBase64 && (
          <PdfMapper
            pdfBase64={config.pdfBase64}
            existingMappings={config.pdfMappings || []}
            availablePlaceholders={widgetPlaceholders}
            onSave={(mappings) => { setConfig({ ...config, pdfMappings: mappings }); setShowPdfMapper(false); }}
            onClose={() => setShowPdfMapper(false)}
          />
        )}

        {/* ── Modal ExcelMapper ── */}
        {showExcelMapper && config.excelBase64 && (
          <ExcelMapper
            excelBase64={config.excelBase64}
            existingMappings={config.excelMappings || []}
            availablePlaceholders={widgetPlaceholders}
            onSave={(mappings, logoBase64) => {
              setConfig({
                ...config,
                excelMappings: mappings,
                ...(logoBase64 ? { excelLogoBase64: logoBase64 } : {}),
              });
              setShowExcelMapper(false);
            }}
            onClose={() => setShowExcelMapper(false)}
          />
        )}

        {/* ── Modal ExcelPreview ← NUEVO ── */}
        {showExcelPreview && config.excelBase64 && (
          <ExcelPreview
            excelBase64={config.excelBase64}
            mappings={config.excelMappings || []}
            availablePlaceholders={widgetPlaceholders}
            customLogoBase64={config.excelLogoBase64}
            onClose={() => setShowExcelPreview(false)}
          />
        )}
      </div>
    </div>
  );
}