import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { widgetRegistry } from "../components/widgets/registry";
import { evaluateRules } from "../utils/formRules";
import type { FormRule, WidgetInstance } from "../types/widget.types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type PublicForm = {
  id: string;
  name: string;
  widgets: WidgetInstance[];
  rules: FormRule[];
  isPublic: boolean;
  sendConfirmationEmail: boolean;
  requiresEmailVerification: boolean;
  verified: boolean;
};

type PageState =
  | "loading"
  | "request_email"   // formulario protegido por OTP, pidiendo email
  | "request_otp"     // email enviado, esperando código
  | "ready"           // formulario visible
  | "submitting"
  | "done"
  | "error"
  | "private";

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [form, setForm] = useState<PublicForm | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // ── 2FA por correo (formularios protegidos) ──────────────────────────────
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Cooldown del botón "Reenviar código" para que el usuario no pueda solicitar
  // OTPs en ráfaga (UX y limita carga al backend; el backend también throttea).
  const RESEND_COOLDOWN_SECONDS = 30;
  const [resendCooldown, setResendCooldown] = useState(0);

  /** Carga el form usando el accessToken si lo tenemos (devuelve schema). */
  const loadForm = (token: string | null) => {
    if (!formId) return;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${API_URL}/api/forms/public/${formId}`, { headers })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 403) setState("private");
          else {
            setState("error");
            setErrorMsg(body.message || "Error cargando el formulario");
          }
          return;
        }
        const data = body as PublicForm;
        setForm(data);
        if (data.requiresEmailVerification && !data.verified) {
          setState("request_email");
        } else {
          setState("ready");
        }
      })
      .catch(() => {
        setState("error");
        setErrorMsg("Error de conexión");
      });
  };

  useEffect(() => {
    if (!formId) {
      setState("error");
      setErrorMsg("ID de formulario inválido");
      return;
    }
    loadForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  // ── Solicitar / verificar OTP ────────────────────────────────────────────

  const handleRequestOtp = async () => {
    if (otpBusy) return;
    setOtpError("");
    setOtpMessage("");
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setOtpError("Por favor ingresa un correo válido.");
      return;
    }
    setOtpBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/api/forms/public/${formId}/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(body.message || "No se pudo enviar el código.");
        return;
      }
      setOtpMessage(body.message ?? "Si tu correo está autorizado, recibirás un código.");
      setState("request_otp");
      // Arrancamos cooldown del botón "Reenviar" cada vez que pedimos un código.
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setOtpError("Error de conexión.");
    } finally {
      setOtpBusy(false);
    }
  };

  // Reenvía el código reusando handleRequestOtp. Limpia el input previo porque
  // el backend invalida OTPs anteriores al crear uno nuevo.
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpBusy) return;
    setOtpCode("");
    setOtpError("");
    await handleRequestOtp();
  };

  // Decrementa el cooldown cada segundo mientras estemos en la pantalla OTP.
  // Se desmonta solo al cambiar el estado o cuando llega a 0.
  useEffect(() => {
    if (state !== "request_otp" || resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, resendCooldown]);

  const handleVerifyOtp = async () => {
    if (otpBusy) return;
    setOtpError("");
    const cleaned = otpCode.replace(/\s+/g, "");
    if (cleaned.length !== 6) {
      setOtpError("El código debe tener 6 dígitos.");
      return;
    }
    setOtpBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/api/forms/public/${formId}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), code: cleaned }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(body.message || "Código incorrecto.");
        setOtpCode("");
        return;
      }
      // OTP correcto → guardamos el token y recargamos el form (ya con schema).
      setAccessToken(body.accessToken);
      loadForm(body.accessToken);
    } catch {
      setOtpError("Error de conexión.");
    } finally {
      setOtpBusy(false);
    }
  };

  // ── Lógica del formulario ────────────────────────────────────────────────

  const hiddenIds = useMemo(
    () => evaluateRules(form?.rules ?? [], fieldValues),
    [form?.rules, fieldValues],
  );

  const visibleWidgets = useMemo(
    () => (form?.widgets ?? []).filter((w) => !hiddenIds.has(w.id)),
    [form?.widgets, hiddenIds],
  );

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    (form?.widgets ?? []).forEach((w) => {
      next[w.id] = String(fd.get(w.id) ?? "");
    });
    setFieldValues(next);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;

    const fd = new FormData(e.currentTarget);

    const missing: string[] = [];
    form.widgets.forEach((w) => {
      if (hiddenIds.has(w.id)) return;
      if (!w.required) return;
      const val = fd.get(w.id);
      if (!val || String(val).trim() === "") missing.push(w.label);
    });
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }
    setMissingFields([]);

    const data: Record<string, string> = {};
    form.widgets.forEach((w) => {
      if (hiddenIds.has(w.id)) return;
      const val = fd.get(w.id);
      if (val !== null) data[w.id] = String(val);
    });

    const emailWidget = form.widgets.find(
      (w) => w.type === "email" && !hiddenIds.has(w.id),
    );
    const userEmail = emailWidget ? data[emailWidget.id] : email;

    setState("submitting");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Si el form requirió OTP, mandamos el accessToken obtenido en verify-otp.
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${API_URL}/api/forms/public/${form.id}/submit`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ data, email: userEmail }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState("error");
        setErrorMsg(err.message || "Error al enviar");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setErrorMsg("Error de conexión al enviar");
    }
  };

  // ── Estados ──────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] font-sans">
        <div className="text-center text-gray-400">
          <div className="mb-3 text-5xl">⏳</div>
          <p>Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (state === "private") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] font-sans p-4">
        <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          <div className="mb-4 text-5xl">🔒</div>
          <h2 className="m-0 mb-2 text-lg font-bold text-gray-900">
            Formulario privado
          </h2>
          <p className="text-sm text-gray-500">
            Este formulario no está disponible públicamente.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] font-sans p-4">
        <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="m-0 mb-2 text-lg font-bold text-gray-900">Error</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Pantalla: pedir email ────────────────────────────────────────────────
  if (state === "request_email" || state === "request_otp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] font-sans p-4">
        <div className="w-full max-w-[440px] rounded-2xl bg-white px-8 py-9 shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-[26px] text-white shadow-[0_4px_14px_rgba(0,194,168,0.35)]">
              🔐
            </div>
            <h1 className="m-0 text-lg font-bold text-slate-900">
              {form?.name ?? "Formulario protegido"}
            </h1>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-slate-500">
              {state === "request_email"
                ? "Para acceder a este formulario, ingresa tu correo electrónico registrado."
                : "Ingresa el código de 6 dígitos que enviamos a tu correo."}
            </p>
          </div>

          {state === "request_email" && (
            <>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                placeholder="tu@correo.com"
                autoFocus
                className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 text-sm text-slate-900 outline-none focus:border-[#00c2a8] focus:bg-white"
              />

              {otpError && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
                  ⚠️ {otpError}
                </div>
              )}

              <button
                onClick={handleRequestOtp}
                disabled={otpBusy || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: otpBusy
                    ? "#94a3b8"
                    : "linear-gradient(135deg,#00c2a8,#0891b2)",
                  boxShadow: otpBusy ? "none" : "0 4px 16px rgba(0,194,168,0.35)",
                }}
              >
                {otpBusy ? "Enviando..." : "Enviar código →"}
              </button>
            </>
          )}

          {state === "request_otp" && (
            <>
              {otpMessage && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-[14px] py-2.5 text-[12.5px] text-emerald-700">
                  ✉️ {otpMessage}
                </div>
              )}

              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Código de 6 dígitos
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                placeholder="000000"
                autoFocus
                className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 text-center font-mono text-[20px] tracking-[0.5em] text-[#0891b2] outline-none focus:border-[#00c2a8] focus:bg-white"
              />

              {otpError && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
                  ⚠️ {otpError}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={otpBusy || otpCode.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: otpBusy
                    ? "#94a3b8"
                    : "linear-gradient(135deg,#00c2a8,#0891b2)",
                  boxShadow: otpBusy ? "none" : "0 4px 16px rgba(0,194,168,0.35)",
                }}
              >
                {otpBusy ? "Verificando..." : "Verificar →"}
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || otpBusy}
                className="mt-3 w-full cursor-pointer rounded-[10px] border-[1.5px] border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-600 transition hover:border-[#00c2a8] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
              >
                {resendCooldown > 0
                  ? `Reenviar código en ${resendCooldown}s`
                  : "↻ Reenviar código"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpCode("");
                  setOtpError("");
                  setOtpMessage("");
                  setResendCooldown(0);
                  setState("request_email");
                }}
                className="mt-2 w-full cursor-pointer rounded-[10px] border-none bg-transparent py-1.5 text-xs font-semibold text-slate-500"
              >
                ← Cambiar correo
              </button>
            </>
          )}

          <p className="mt-5 text-center text-[10px] text-gray-400">
            Powered by SoulForms · Grupo Soul
          </p>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 font-sans p-4">
        <div className="w-full max-w-[480px] rounded-[20px] bg-white px-9 py-12 text-center shadow-[0_12px_40px_rgba(0,194,168,0.15)]">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00c2a8] to-emerald-600 text-[38px]">
            ✅
          </div>
          <h2 className="m-0 mb-2.5 text-[22px] font-bold text-gray-900">
            ¡Enviado correctamente!
          </h2>
          <p className="text-sm leading-relaxed text-gray-500">
            Gracias por completar el formulario. Hemos recibido tu respuesta.
            {form?.sendConfirmationEmail && " Recibirás un email de confirmación."}
          </p>
          <button
            onClick={() => {
              setState("ready");
              formRef.current?.reset();
              setFieldValues({});
            }}
            className="mt-6 cursor-pointer rounded-lg border-none bg-[#00c2a8] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Enviar otra respuesta
          </button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const submitting = state === "submitting";

  return (
    <div className="min-h-screen bg-[#f0f4f8] px-4 py-8 font-sans">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-1 rounded-t-2xl bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-6 py-5 text-white">
          <h1 className="m-0 text-xl font-extrabold">{form.name}</h1>
          <p className="m-0 mt-1 text-xs opacity-75">
            Completa todos los campos obligatorios (*)
          </p>
        </div>
        <div className="h-1 bg-[#00c2a8]" />

        <div className="rounded-b-2xl bg-white px-5 py-7 shadow-[0_4px_20px_rgba(0,0,0,0.08)] sm:px-7">
          {missingFields.length > 0 && (
            <div className="mb-5 rounded-lg border-[1.5px] border-red-200 bg-red-50 px-4 py-3">
              <div className="mb-1 text-[13px] font-bold text-red-600">
                ⚠️ Campos obligatorios faltantes:
              </div>
              <ul className="m-0 pl-4 text-xs text-red-700">
                {missingFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} onChange={handleFormChange}>
            <div className="flex flex-col gap-[18px]">
              {visibleWidgets.map((widget) => {
                const RenderComponent = widgetRegistry[widget.type]?.render;
                if (!RenderComponent) return null;
                return (
                  <div
                    key={widget.id}
                    className="rounded-[10px] border border-gray-200 bg-slate-50 px-4 py-3.5"
                    style={{ opacity: submitting ? 0.7 : 1 }}
                  >
                    <RenderComponent widget={widget} />
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-[10px] border-none px-8 py-3 text-[15px] font-bold text-white sm:w-auto"
                style={{
                  background: submitting ? "#94a3b8" : "#00c2a8",
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting ? "none" : "0 4px 14px rgba(0,194,168,0.4)",
                }}
              >
                {submitting ? "Enviando..." : "📤 Enviar formulario"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-400">
          Powered by SoulForms · Grupo Soul
        </p>
      </div>
    </div>
  );
}
