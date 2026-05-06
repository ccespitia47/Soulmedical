import { useState } from "react";
import { login as apiLogin, register as apiRegister, saveSession } from "../services/api";
import type { AuthUser } from "../types/auth.types";
import { ROLE_AVATARS } from "../types/auth.types";

type LoginProps = {
  onLogin: (user: AuthUser) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLoginResult = (backendUser: { id: number; email: string; name: string; role: string }, access_token: string) => {
    const authUser: AuthUser = {
      id: backendUser.id,
      email: backendUser.email,
      name: backendUser.name,
      role: backendUser.role as AuthUser["role"],
      avatar: ROLE_AVATARS[backendUser.role as AuthUser["role"]] ?? "👤",
    };
    saveSession(access_token, { id: backendUser.id, name: backendUser.name, email: backendUser.email, role: backendUser.role as AuthUser["role"] });
    onLogin(authUser);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setError("");
    setLoading(true);

    const result = await apiLogin(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      handleLoginResult(result.data.user, result.data.access_token);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) {
      setError("Por favor completa todos los campos.");
      return;
    }
    if (regPassword.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    setError("");
    setLoading(true);

    const result = await apiRegister(regName, regEmail, regPassword, "user");
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      handleLoginResult(result.data.user, result.data.access_token);
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError("");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px 12px 42px",
    border: "1.5px solid #e2e8f0", borderRadius: 10,
    fontSize: 14, color: "#0f172a", background: "#f8fafc",
    outline: "none", boxSizing: "border-box", transition: "all 0.2s",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#00c2a8";
    e.target.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
    e.target.style.background = "#fff";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#e2e8f0";
    e.target.style.boxShadow = "none";
    e.target.style.background = "#f8fafc";
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
    marginBottom: 6, letterSpacing: "0.4px", textTransform: "uppercase",
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

        {/* Logo */}
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
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", margin: "4px 0 0", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px)",
          borderRadius: 20, padding: "36px 36px 32px",
          boxShadow: "0 24px 60px rgba(0,40,80,0.22), 0 1px 0 rgba(255,255,255,0.6) inset",
          border: "1px solid rgba(255,255,255,0.7)",
        }}>

          {mode === "login" ? (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Bienvenido</h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>Ingresa tus credenciales para continuar</p>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Correo electronico</label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>✉️</div>
                  <input type="email" name="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@gruposoul.com" onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>
              </div>

              {/* Contrasena */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Contrasena</label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔒</div>
                  <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    style={{ ...inputStyle, paddingRight: 44 }} onFocus={handleFocus} onBlur={handleBlur} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", padding: "2px" }}>
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Boton Ingresar */}
              <button onClick={handleLogin} disabled={loading} style={{
                width: "100%", padding: "13px",
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
                transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Ingresando...
                  </>
                ) : "Ingresar →"}
              </button>

              {/* Link a registro */}
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>¿No tienes cuenta? </span>
                <button onClick={() => switchMode("register")} style={{
                  background: "none", border: "none", fontSize: 13, color: "#00c2a8",
                  fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline",
                }}>
                  Crear cuenta nueva
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Crear cuenta</h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>Completa tus datos para registrarte</p>

              {/* Nombre completo */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Nombre completo</label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>👤</div>
                  <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej: Juan Perez Rodriguez"
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} autoFocus />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Correo electronico</label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>✉️</div>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="usuario@gruposoul.com"
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>
              </div>

              {/* Contrasena */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Contrasena</label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔒</div>
                  <input type={showRegPassword ? "text" : "password"} value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)} placeholder="Minimo 6 caracteres"
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    style={{ ...inputStyle, paddingRight: 44 }} onFocus={handleFocus} onBlur={handleBlur} />
                  <button type="button" onClick={() => setShowRegPassword(!showRegPassword)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", padding: "2px" }}>
                    {showRegPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Boton Crear */}
              <button onClick={handleRegister} disabled={loading} style={{
                width: "100%", padding: "13px",
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
                transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Creando cuenta...
                  </>
                ) : "Crear cuenta →"}
              </button>

              {/* Link a login */}
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>¿Ya tienes cuenta? </span>
                <button onClick={() => switchMode("login")} style={{
                  background: "none", border: "none", fontSize: 13, color: "#00c2a8",
                  fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline",
                }}>
                  Iniciar sesion
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 20 }}>
          © {new Date().getFullYear()} SoulForms · Todos los derechos reservados
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
