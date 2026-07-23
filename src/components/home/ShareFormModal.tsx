import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const APP_URL = import.meta.env.VITE_APP_URL ?? "http://10.10.20.15:5173";

type ShareFormModalProps = {
  formId: string;
  formName: string;
  isPublic: boolean;
  sendConfirmationEmail: boolean;
  requiresEmailVerification?: boolean;
  token: string | null;
  onClose: () => void;
  onUpdate: (
    isPublic: boolean,
    sendConfirmationEmail: boolean,
    requiresEmailVerification: boolean,
  ) => void;
};

export default function ShareFormModal({
  formId,
  formName,
  isPublic: initialIsPublic,
  sendConfirmationEmail: initialSendConfirm,
  requiresEmailVerification: initialRequires2FA = false,
  token,
  onClose,
  onUpdate,
}: ShareFormModalProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(initialSendConfirm);
  const [requires2FA, setRequires2FA] = useState(initialRequires2FA);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${APP_URL}/f/${formId}`;

  /**
   * Único punto que pega al backend. Recibe los 3 campos y envía los 3 juntos,
   * para que activar un toggle no pise el estado de otro.
   */
  const patchShareSettings = async (next: {
    isPublic: boolean;
    sendConfirmationEmail: boolean;
    requiresEmailVerification: boolean;
  }) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/forms/${formId}/toggle-public`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(next),
      });
      setIsPublic(next.isPublic);
      setSendConfirmationEmail(next.sendConfirmationEmail);
      setRequires2FA(next.requiresEmailVerification);
      onUpdate(
        next.isPublic,
        next.sendConfirmationEmail,
        next.requiresEmailVerification,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (newIsPublic: boolean) =>
    patchShareSettings({
      isPublic: newIsPublic,
      sendConfirmationEmail,
      requiresEmailVerification: requires2FA,
    });

  const handleConfirmToggle = (v: boolean) =>
    patchShareSettings({
      isPublic,
      sendConfirmationEmail: v,
      requiresEmailVerification: requires2FA,
    });

  const handle2FAToggle = (v: boolean) =>
    patchShareSettings({
      isPublic,
      sendConfirmationEmail,
      requiresEmailVerification: v,
    });

  const handleCopy = async () => {
    try {
      // navigator.clipboard solo está disponible en contextos seguros
      // (HTTPS o localhost). La app vive en http://10.10.20.15:5173 (LAN),
      // por eso necesitamos el fallback con execCommand para que copiar
      // funcione también en navegadores que no exponen la Clipboard API.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = publicUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, publicUrl.length);
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[ShareFormModal] No se pudo copiar al portapapeles:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[520px] rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-lg">
              🔗
            </div>
            <div>
              <div className="text-[15px] font-bold text-gray-900">Compartir formulario</div>
              <div className="text-xs text-gray-500">{formName}</div>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer border-none bg-slate-100 rounded-lg w-8 h-8 text-slate-500 text-base">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Toggle acceso público */}
          <div className="mb-5 flex items-center justify-between rounded-xl border-2 p-4"
            style={{ background: isPublic ? "#f0fdf4" : "#f9fafb", borderColor: isPublic ? "#00c2a8" : "#e2e8f0" }}>
            <div>
              <div className="text-[13px] font-bold text-gray-900">
                {isPublic ? "🌐 Formulario público" : "🔒 Formulario privado"}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {isPublic
                  ? "Cualquier persona con el link puede acceder y enviar respuestas"
                  : "Solo usuarios del sistema pueden acceder"}
              </div>
            </div>
            <button
              onClick={() => handleToggle(!isPublic)}
              disabled={saving}
              className="relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-none transition-colors"
              style={{ background: isPublic ? "#00c2a8" : "#d1d5db" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ left: isPublic ? "calc(100% - 22px)" : "2px" }}
              />
            </button>
          </div>

          {/* URL pública */}
          {isPublic && (
            <>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-gray-500">
                  URL del formulario
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                    {publicUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 cursor-pointer rounded-lg border-none px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                    style={{ background: copied ? "#10b981" : "#00c2a8" }}
                  >
                    {copied ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* QR hint */}
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-2xl">📱</span>
                <div className="text-xs text-gray-600">
                  <strong>Tip:</strong> Puedes generar un código QR con esta URL para que los usuarios accedan fácilmente desde su celular.
                </div>
              </div>

              {/* Email de confirmación */}
              <label className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={sendConfirmationEmail}
                  onChange={(e) => handleConfirmToggle(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                  disabled={saving}
                />
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">
                    Enviar email de confirmación al usuario
                  </div>
                  <div className="text-xs text-gray-500">
                    Si el formulario tiene un campo de email, se enviará confirmación automáticamente
                  </div>
                </div>
              </label>

              {/* 2FA por correo */}
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors"
                style={{
                  background: requires2FA ? "#eff6ff" : "#f9fafb",
                  borderColor: requires2FA ? "#3b82f6" : "#e2e8f0",
                }}
              >
                <input
                  type="checkbox"
                  checked={requires2FA}
                  onChange={(e) => handle2FAToggle(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-blue-500"
                  disabled={saving}
                />
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">
                    🔐 Requerir verificación por correo
                  </div>
                  <div className="text-xs text-gray-500">
                    Antes de mostrar el formulario, se pide un correo registrado
                    y un código de 6 dígitos (válido 2 minutos). Solo usuarios
                    creados en el sistema reciben el código.
                  </div>
                </div>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}