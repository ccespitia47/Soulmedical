import { useState } from "react";
import { register } from "../services/api";

type RegisterProps = {
  onBackToLogin: () => void;
};

export default function Register({ onBackToLogin }: RegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!name || !email || !password || !confirm) {
      setError("Por favor completa todos los campos.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "No se pudo crear la solicitud.");
      return;
    }
    setSuccess(result.data.message);
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundImage: `url('/Imagen_Fondo.jpeg')`,
      backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(8,40,80,0.18)", backdropFilter: "blur(1px)" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, margin: "0 16px" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64, borderRadius: 20,
            background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
            boxShadow: "0 8px 32px rgba(0,194,168,0.45)", marginBottom: 14,
          }}>
            <span style={{ fontSize: 32 }}>🏥</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px", textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
            SoulForms
          </h1>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px)",
          borderRadius: 20, padding: "36px 36px 32px",
          boxShadow: "0 24px 60px rgba(0,40,80,0.22), 0 1px 0 rgba(255,255,255,0.6) inset",
          border: "1px solid rgba(255,255,255,0.7)",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Crear cuenta</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>
            Tu solicitud quedará pendiente hasta que un administrador la apruebe.
          </p>

          {success ? (
            <div style={{ padding: "14px 16px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, fontSize: 13, color: "#065f46", marginBottom: 16, lineHeight: 1.5 }}>
              ✅ {success}
            </div>
          ) : (
            <>
              <Field label="Nombre completo" icon="👤">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  style={inputStyle}
                />
              </Field>

              <Field label="Correo electrónico" icon="✉️">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@gruposoul.com"
                  style={inputStyle}
                />
              </Field>

              <Field label="Contraseña" icon="🔒">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", padding: "2px" }}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </Field>

              <Field label="Confirmar contraseña" icon="🔒">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Repite la contraseña"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              ⚠️ {error}
            </div>
          )}

          {!success && (
            <button onClick={handleSubmit} disabled={loading} style={primaryButtonStyle(loading)}>
              {loading ? "Creando..." : "Crear cuenta →"}
            </button>
          )}

          <button onClick={onBackToLogin} style={{ width: "100%", padding: 10, marginTop: 12, background: "none", border: "none", color: "#0891b2", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px 12px 42px",
  border: "1.5px solid #e2e8f0", borderRadius: 10,
  fontSize: 14, color: "#0f172a", background: "#f8fafc",
  outline: "none", boxSizing: "border-box",
};

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, letterSpacing: "0.4px", textTransform: "uppercase" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>{icon}</div>
        {children}
      </div>
    </div>
  );
}

function primaryButtonStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "13px",
    background: loading ? "#94a3b8" : "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
    color: "#fff", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
    boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
    fontFamily: "inherit",
  };
}
