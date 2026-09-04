import { useState } from "react";
import BuilderCanvas from "./BuilderCanvas";
import WidgetPalette from "./WidgetPalette";
import PropertyPanel from "../properties/PropertyPanel";
import RulesPanel from "./RulesPanel";
import Icon from "../common/Icon";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useTemplatesStore } from "../../store/useTemplatesStore";
import PreviewPage from "@/pages/PreviewPage";
import EmailConfigPanel from "../email/EmailConfigPanel";
import { useFolderStore } from "../../store/useFolderStore";
import type { FormVersion } from "../../types/folder.types";
import PasteButton from "./PasteButton";

// ── Modal de éxito ────────────────────────────────────────────────────────────
function SuccessModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 32px", width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #00c2a8, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(0,194,168,0.35)" }}>
          <span style={{ fontSize: 36, color: "#fff" }}>✓</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 28px", lineHeight: 1.6 }}>{message}</p>
        <button onClick={onClose} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #00c2a8, #0891b2)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Entendido</button>
      </div>
    </div>
  );
}

// ── Modal guardar como plantilla ──────────────────────────────────────────────
function SaveTemplateModal({ onSave, onClose, templateFolders }: {
  onSave: (name: string, folderId: string, description: string, icon: string) => void;
  onClose: () => void;
  templateFolders: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(templateFolders[0]?.id ?? "");
  const [icon, setIcon] = useState("📋");
  const icons = ["📋","📝","🏥","👥","📊","⚙️","🎯","📦","💊","🔬"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 20px" }}>💾 Guardar como plantilla</h2>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Registro de pacientes" style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 14 }} autoFocus />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Descripción</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción opcional..." style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 14 }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Carpeta *</label>
        {templateFolders.length === 0 ? (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", marginBottom: 14 }}>⚠️ Primero crea una carpeta en la sección de Plantillas</div>
        ) : (
          <select value={folderId} onChange={e => setFolderId(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 14 }}>
            {templateFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Ícono</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {icons.map(ic => <button key={ic} onClick={() => setIcon(ic)} style={{ width: 38, height: 38, borderRadius: 8, fontSize: 20, cursor: "pointer", border: icon === ic ? "2px solid #00c2a8" : "2px solid #e2e8f0", background: icon === ic ? "#e6faf7" : "#fff" }}>{ic}</button>)}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { if (name.trim() && folderId) onSave(name.trim(), folderId, description, icon); }} disabled={!name.trim() || !folderId}
            style={{ padding: "10px 20px", background: !name.trim() || !folderId ? "#e2e8f0" : "#00c2a8", color: !name.trim() || !folderId ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !name.trim() || !folderId ? "not-allowed" : "pointer" }}>
            💾 Guardar plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal publicar ────────────────────────────────────────────────────────────
function PublishModal({ currentVersion, onPublish, onClose }: { currentVersion: number; onPublish: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>🚀 Publicar formulario</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Se creará la versión <strong>v{currentVersion + 1}</strong> y será visible para los usuarios.</p>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nota del cambio (opcional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: Se agregó campo de diagnóstico"
          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 20 }} autoFocus onKeyDown={e => e.key === "Enter" && onPublish(note)} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => onPublish(note)} style={{ padding: "10px 20px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>🚀 Publicar</button>
        </div>
      </div>
    </div>
  );
}

// ── Panel historial ───────────────────────────────────────────────────────────
function VersionHistoryPanel({ versions, currentVersion, onRevert, onClose }: { versions: FormVersion[]; currentVersion: number; onRevert: (v: number) => void; onClose: () => void }) {
  const [confirmRevert, setConfirmRevert] = useState<number | null>(null);
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>📋 Historial de versiones</h2>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{versions.length} versión{versions.length !== 1 ? "es" : ""}</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
        {sorted.length === 0 && <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: 10 }}><span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📋</span><p style={{ fontSize: 13, margin: 0 }}>Sin versiones publicadas</p></div>}
        {sorted.map((v) => {
          const isCurrent = v.versionNumber === currentVersion;
          return (
            <div key={v.versionNumber} style={{ border: `1.5px solid ${isCurrent ? "#00c2a8" : "#e2e8f0"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, background: isCurrent ? "#e6faf7" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: isCurrent ? "#00c2a8" : "#f3f4f6", color: isCurrent ? "#fff" : "#374151" }}>v{v.versionNumber}</span>
                  {isCurrent && <span style={{ fontSize: 11, color: "#00c2a8", fontWeight: 600 }}>● Actual</span>}
                </div>
                {!isCurrent && <button onClick={() => setConfirmRevert(v.versionNumber)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#f3f4f6", color: "#374151", border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 600 }}>↩ Revertir</button>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{v.note || `Versión ${v.versionNumber}`}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>👤 {v.publishedBy} · 🕐 {v.publishedAt}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{v.widgets.length} campo{v.widgets.length !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>
      {confirmRevert !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>↩</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>¿Revertir a v{confirmRevert}?</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6 }}>El borrador y la versión publicada volverán a los campos de esa versión.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmRevert(null)} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => { onRevert(confirmRevert); setConfirmRevert(null); }} style={{ padding: "10px 20px", background: "#f97316", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>↩ Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BuilderLayout({ folderId, formId, onBack }: { folderId?: string; formId?: string; onBack?: () => void }) {
  const widgets = useBuilderStore((s) => s.widgets);
  const { folders, saveFormWidgets, saveFormRules, publishForm, revertToVersion } = useFolderStore();
  const { currentUser } = useAuthStore();
  const { templateFolders, addTemplate } = useTemplatesStore();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);

  const folder = folders.find(f => f.id === folderId);
  const form = folder?.forms.find(fm => fm.id === formId);
  const rules = form?.rules ?? [];
  const formEmailTemplate = form?.emailTemplate;
  const versions = form?.versions ?? [];
  const currentVersion = form?.currentVersion ?? 0;
  const formStatus = form?.status ?? "draft";

  const handleSave = () => {
    if (!folderId || !formId) return;
    setSaveStatus("saving");
    saveFormWidgets(folderId, formId, widgets);
    setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); }, 500);
  };

  // ── PUNTO 1: al publicar, guardar y volver a formularios ──────────────────
  const handlePublish = (note: string) => {
    if (!folderId || !formId) return;
    saveFormWidgets(folderId, formId, widgets);
    publishForm(folderId, formId, currentUser?.name ?? "Admin", note);
    setShowPublishModal(false);
    onBack?.();
  };

  const handleRevert = (versionNumber: number) => {
    if (!folderId || !formId) return;
    revertToVersion(folderId, formId, versionNumber);
    setShowVersionHistory(false);
  };

  const handleSaveAsTemplate = (name: string, tfolderId: string, description: string, icon: string) => {
    addTemplate({
      name,
      description,
      icon,
      folderId: tfolderId,
      widgets,
      // Snapshot completo: reglas y configuración de email del formulario
      // actual, para que al reutilizar la plantilla todo quede igual.
      rules,
      emailTemplate: formEmailTemplate,
      createdBy: currentUser?.name ?? "Admin",
    });
    setShowTemplateModal(false);
    setSuccessModal({ title: "¡Plantilla guardada!", message: `La plantilla "${name}" fue guardada correctamente y ya está disponible en la sección de Plantillas.` });
  };

  const rightPanelMode = showVersionHistory ? "versions" : showRulesPanel ? "rules" : "properties";
  const rightPanelWidth = showVersionHistory ? 320 : showRulesPanel ? 480 : 288;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header style={{ height: 56, background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", background: "#0F1623", borderRadius: 8, padding: "5px 9px" }}>
            <img src="/soulforms-logo-dark.png" alt="SoulForms" style={{ height: 22, objectFit: "contain" }} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "#0f172a" }}>Editor de Formulario</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 700, background: formStatus === "published" ? "#e6faf7" : "#fffbeb", color: formStatus === "published" ? "#0891b2" : "#d97706", border: `1px solid ${formStatus === "published" ? "rgba(0,194,168,0.4)" : "#fde68a"}` }}>
            <Icon name={formStatus === "published" ? "checkCircle" : "edit"} size={12} />
            {formStatus === "published" ? "Publicado" : "Borrador"}{currentVersion > 0 && ` · v${currentVersion}`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PasteButton folderId={folderId} formId={formId} widgets={widgets} rules={rules} saveFormRules={saveFormRules} />
          <button onClick={() => setShowPreview(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "inherit", transition: "all 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#334155"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
            <Icon name="eye" size={14} /> Preview
          </button>
          <button onClick={() => setShowEmailConfig(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "inherit", transition: "all 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#334155"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
            <Icon name="mail" size={14} /> Email
          </button>
          <button onClick={() => { setShowRulesPanel(!showRulesPanel); setShowVersionHistory(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, position: "relative", border: `1.5px solid ${showRulesPanel ? "#00c2a8" : "#e2e8f0"}`, background: showRulesPanel ? "#e6faf7" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: showRulesPanel ? "#0891b2" : "#64748b", fontFamily: "inherit" }}>
            <Icon name="settings" size={14} /> Reglas
            {rules.length > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#00c2a8", color: "#fff", fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{rules.length}</span>}
          </button>
          <button onClick={() => { setShowVersionHistory(!showVersionHistory); setShowRulesPanel(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, position: "relative", border: `1.5px solid ${showVersionHistory ? "#8b5cf6" : "#e2e8f0"}`, background: showVersionHistory ? "#f5f3ff" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: showVersionHistory ? "#8b5cf6" : "#64748b", fontFamily: "inherit" }}>
            <Icon name="clock" size={14} /> Versiones
            {versions.length > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#8b5cf6", color: "#fff", fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{versions.length}</span>}
          </button>
          <button onClick={() => setShowTemplateModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "inherit", transition: "all 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#334155"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
            <Icon name="templates" size={14} /> Plantilla
          </button>
          <div style={{ width: 1, background: "#e2e8f0", margin: "8px 4px" }} />
          <button onClick={handleSave} disabled={saveStatus === "saving"} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: saveStatus === "saved" ? "#e6faf7" : "#fff", color: saveStatus === "saved" ? "#0891b2" : "#374151", cursor: saveStatus === "saving" ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
            <Icon name={saveStatus === "saving" ? "refresh" : saveStatus === "saved" ? "checkCircle" : "save"} size={14} className={saveStatus === "saving" ? "animate-spin" : ""} />
            {saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : "Guardar"}
          </button>
          <button onClick={() => setShowPublishModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #00c2a8, #0891b2)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", boxShadow: "0 4px 14px -4px rgba(0,194,168,0.55)", transition: "all 0.2s ease-out" }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 24px -6px rgba(0,194,168,0.6)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 14px -4px rgba(0,194,168,0.55)"; }}>
            <Icon name="rocket" size={14} /> Guardar y Publicar
          </button>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "inherit", transition: "all 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#fecaca"; e.currentTarget.style.color = "#dc2626"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
            <Icon name="x" size={14} /> Cerrar
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 256, flexShrink: 0, borderRight: "1px solid #e2e8f0", overflowY: "auto", background: "#ffffff", display: "flex", flexDirection: "column" }} className="sf-hide-mobile"><WidgetPalette /></div>
        <main style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}><BuilderCanvas folderId={folderId} formId={formId} /></main>
        <div style={{ width: rightPanelWidth, flexShrink: 0, borderLeft: "1px solid #e2e8f0", overflowY: "auto", background: "#ffffff", transition: "width 0.2s ease" }} className="sf-hide-mobile">
          {rightPanelMode === "versions" ? <VersionHistoryPanel versions={versions} currentVersion={currentVersion} onRevert={handleRevert} onClose={() => setShowVersionHistory(false)} />
            : rightPanelMode === "rules" ? <RulesPanel widgets={widgets} rules={rules} onChange={(r) => folderId && formId && saveFormRules(folderId, formId, r)} onClose={() => setShowRulesPanel(false)} />
            : <PropertyPanel />}
        </div>
      </div>

      {showPublishModal && <PublishModal currentVersion={currentVersion} onPublish={handlePublish} onClose={() => setShowPublishModal(false)} />}
      {showTemplateModal && <SaveTemplateModal templateFolders={templateFolders} onSave={handleSaveAsTemplate} onClose={() => setShowTemplateModal(false)} />}
      {successModal && <SuccessModal title={successModal.title} message={successModal.message} onClose={() => setSuccessModal(null)} />}
      {showPreview && <div style={{ position: "fixed", inset: 0, zIndex: 200 }}><PreviewPage onClose={() => setShowPreview(false)} /></div>}
      {showEmailConfig && <EmailConfigPanel folderId={folderId} formId={formId} onClose={() => setShowEmailConfig(false)} />}
      <style>{`@media (max-width: 768px) { .sf-hide-mobile { display: none !important; } main { padding: 16px 12px 100px !important; } }`}</style>
    </div>
  );
}