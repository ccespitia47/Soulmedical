import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  downloadReportApi,
  getReportDownloadMetaApi,
} from "../services/api";

type State =
  | { kind: "loading" }
  | { kind: "not_logged_in" }
  | { kind: "ready"; formName: string; expiresAt: number }
  | { kind: "verify_2fa"; formName: string; expiresAt: number }
  | { kind: "downloading"; formName: string }
  | { kind: "done"; filename: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const ACCENT_GRADIENT = "linear-gradient(135deg,#00c2a8,#0891b2)";
const ACCENT = "#00c2a8";
const SHADOW = "rgba(0,194,168,0.35)";

type DownloadKind = "excel" | "bulk-pdf";

export default function ReportDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.currentUser);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [downloadKind, setDownloadKind] = useState<DownloadKind>("excel");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const isBulkPdf = downloadKind === "bulk-pdf";

  // Timer visible: se actualiza cada segundo. Al llegar a 0, la UI cambia a expired.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Enlace inválido." });
      return;
    }
    if (!user) {
      setState({ kind: "not_logged_in" });
      return;
    }
    (async () => {
      const res = await getReportDownloadMetaApi(token);
      if (res.error || !res.data) {
        setState({ kind: "expired" });
        return;
      }
      setDownloadKind(res.data.kind ?? "excel");
      setState({
        kind: "ready",
        formName: res.data.formName,
        expiresAt: new Date(res.data.expiresAt).getTime(),
      });
    })();
  }, [token, user]);

  // Reset "verify_2fa" → "expired" cuando el reloj pasa expiresAt.
  useEffect(() => {
    if (state.kind !== "ready" && state.kind !== "verify_2fa") return;
    if (now >= state.expiresAt) {
      setState({ kind: "expired" });
    }
  }, [now, state]);

  const remainingLabel = useMemo(() => {
    if (state.kind !== "ready" && state.kind !== "verify_2fa") return "";
    const remaining = Math.max(0, state.expiresAt - now);
    const s = Math.floor(remaining / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [state, now]);

  const handleGoToVerify = () => {
    if (state.kind !== "ready") return;
    setState({ kind: "verify_2fa", formName: state.formName, expiresAt: state.expiresAt });
    setTimeout(() => codeInputRef.current?.focus(), 30);
  };

  const handleVerifyAndDownload = async () => {
    if (state.kind !== "verify_2fa" || !token) return;
    if (busy) return;
    const cleaned = code.replace(/\s+/g, "");
    if (cleaned.length !== 6) {
      setCodeError("El código debe tener 6 dígitos.");
      return;
    }
    setBusy(true);
    setCodeError("");
    const res = await downloadReportApi(token, cleaned);
    setBusy(false);
    if (res.error || !res.data) {
      setCodeError(res.error ?? "No se pudo descargar el reporte.");
      setCode("");
      return;
    }
    // Descarga: crea objectURL invisible y dispara click.
    setState({ kind: "downloading", formName: state.formName });
    const url = URL.createObjectURL(res.data.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setState({ kind: "done", filename: res.data.filename });
  };

  const goLogin = () => {
    const returnTo = window.location.pathname;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans">
      <div className="w-full max-w-[440px] rounded-2xl bg-white px-8 py-9 shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[26px] text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 14px ${SHADOW}` }}
          >
            {isBulkPdf ? "🗂️" : "📊"}
          </div>
          <h1 className="m-0 text-lg font-bold text-slate-900">
            {isBulkPdf ? "Descarga masiva de PDFs" : "Descarga de reporte"}
          </h1>
        </div>

        {state.kind === "loading" && (
          <p className="text-center text-sm text-slate-400">Cargando…</p>
        )}

        {state.kind === "not_logged_in" && (
          <>
            <p className="mb-4 text-center text-[13px] text-slate-600">
              Debes iniciar sesión para descargar el reporte.
            </p>
            <button
              onClick={goLogin}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Iniciar sesión →
            </button>
          </>
        )}

        {state.kind === "ready" && (
          <>
            <p className="mb-1 text-center text-[13px] text-slate-600">
              Formulario:
            </p>
            <p className="mb-4 text-center text-base font-semibold text-slate-900">
              {state.formName}
            </p>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-center text-[12px] text-amber-800">
              ⏱ Expira en <strong>{remainingLabel}</strong>
            </div>
            <p className="mb-5 text-center text-[12px] leading-relaxed text-slate-500">
              Al confirmar, se te pedirá el código de tu app authenticator.
              {isBulkPdf ? (
                <>
                  {" "}Luego se descargará un <strong>ZIP cifrado</strong> con
                  los PDF(s) del formulario. Para abrirlo, te pedirá tu{" "}
                  <strong>número de documento</strong> como contraseña.
                </>
              ) : (
                <>
                  {" "}Luego recibirás un archivo Excel cifrado. Para abrirlo,
                  Excel te pedirá tu <strong>número de documento</strong> como
                  contraseña.
                </>
              )}
            </p>
            <button
              onClick={handleGoToVerify}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Verificar 2FA y descargar →
            </button>
          </>
        )}

        {state.kind === "verify_2fa" && (
          <>
            <p className="mb-1 text-center text-[13px] text-slate-600">
              Formulario:
            </p>
            <p className="mb-3 text-center text-base font-semibold text-slate-900">
              {state.formName}
            </p>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-center text-[11px] text-amber-800">
              ⏱ Expira en <strong>{remainingLabel}</strong>
            </div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
              Código de 6 dígitos
            </label>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyAndDownload()}
              placeholder="000000"
              className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 text-center font-mono text-[20px] tracking-[0.5em] text-slate-900 outline-none focus:border-current focus:bg-white"
              style={{ color: ACCENT }}
            />
            {codeError && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
                ⚠️ {codeError}
              </div>
            )}
            <button
              onClick={handleVerifyAndDownload}
              disabled={busy || code.length !== 6}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: busy ? "#94a3b8" : ACCENT_GRADIENT,
                boxShadow: busy ? "none" : `0 4px 16px ${SHADOW}`,
              }}
            >
              {busy
                ? "Descargando…"
                : isBulkPdf
                ? "Descargar ZIP →"
                : "Descargar reporte →"}
            </button>
          </>
        )}

        {state.kind === "downloading" && (
          <p className="text-center text-[13px] text-slate-500">
            {isBulkPdf ? "Descargando ZIP de" : "Descargando reporte de"}{" "}
            <strong>{state.formName}</strong>…
          </p>
        )}

        {state.kind === "done" && (
          <>
            <p className="mb-2 text-center text-base font-semibold text-emerald-700">
              {isBulkPdf ? "✅ ZIP descargado" : "✅ Reporte descargado"}
            </p>
            <p className="mb-4 text-center text-[12.5px] text-slate-600">
              Revisa tu carpeta de descargas: <br />
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-800">
                {state.filename}
              </code>
            </p>
            <p className="mb-5 text-center text-[12px] text-slate-500">
              {isBulkPdf ? (
                <>
                  Para abrir el ZIP, la contraseña es tu{" "}
                  <strong>número de documento</strong>.
                </>
              ) : (
                <>
                  Para abrirlo en Excel, la contraseña es tu{" "}
                  <strong>número de documento</strong>.
                </>
              )}
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-gray-600"
            >
              Volver a la app
            </button>
          </>
        )}

        {state.kind === "expired" && (
          <>
            <p className="mb-4 text-center text-base font-semibold text-red-600">
              Enlace no válido o expirado
            </p>
            <p className="mb-5 text-center text-[12.5px] text-slate-500">
              El link es de un solo uso y expira en 2 minutos. Solicita el reporte de nuevo desde la app.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Volver a la app →
            </button>
          </>
        )}

        {state.kind === "error" && (
          <p className="text-center text-[13px] text-red-600">
            ⚠️ {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
