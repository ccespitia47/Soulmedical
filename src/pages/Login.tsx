import { useState } from "react";

type LoginProps = {
  onLogin: () => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setError("");
    setLoading(true);
    // Simula validación — reemplaza con tu lógica de auth real
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);

    // Validación básica de ejemplo (reemplaza con tu backend/auth)
    if (email && password.length >= 4) {
      onLogin();
    } else {
      setError("Credenciales incorrectas. Intenta de nuevo.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: `url('/Imagen_Fondo.jpeg')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
    }}>
      {/* Overlay sutil para mejorar legibilidad */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(8, 40, 80, 0.18)",
        backdropFilter: "blur(1px)",
      }} />

      {/* Card principal */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 420,
        margin: "0 16px",
      }}>

        {/* Logo / Marca */}
        <div style={{
          textAlign: "center",
          marginBottom: 28,
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
            boxShadow: "0 8px 32px rgba(0,194,168,0.45)",
            marginBottom: 14,
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4zm1 17h-2v-6h2v6zm0-8h-2V11h2v2z" fill="white" opacity="0.9"/>
              <rect x="14" y="9" width="4" height="2" rx="1" fill="white"/>
              <rect x="14" y="13" width="4" height="6" rx="1" fill="white"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.5px",
            textShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}>
            SoulForms
          </h1>
          <p style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.82)",
            margin: "4px 0 0",
            textShadow: "0 1px 6px rgba(0,0,0,0.2)",
            letterSpacing: "0.3px",
          }}>
            
          </p>
        </div>

        {/* Card glassmorphism */}
        <div style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 20,
          padding: "36px 36px 32px",
          boxShadow: "0 24px 60px rgba(0,40,80,0.22), 0 1px 0 rgba(255,255,255,0.6) inset",
          border: "1px solid rgba(255,255,255,0.7)",
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 4px",
          }}>
            Bienvenido de nuevo
          </h2>
          <p style={{
            fontSize: 13,
            color: "#64748b",
            margin: "0 0 28px",
          }}>
            Ingresa tus credenciales para continuar
          </p>

          {/* Campo Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
            }}>
              Correo electrónico
            </label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: 16,
              }}>
                ✉️
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@clinica.com"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 42px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#0f172a",
                  background: "#f8fafc",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#00c2a8";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
                  e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#f8fafc";
                }}
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
            }}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: 16,
              }}>
                🔒
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{
                  width: "100%",
                  padding: "12px 44px 12px 42px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#0f172a",
                  background: "#f8fafc",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#00c2a8";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
                  e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#f8fafc";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#94a3b8",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Olvidé contraseña */}
          <div style={{ textAlign: "right", marginBottom: 24 }}>
            <button style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "#00c2a8",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              fontSize: 13,
              color: "#dc2626",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botón Ingresar */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading
                ? "#94a3b8"
                : "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
              transition: "all 0.2s",
              letterSpacing: "0.3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(0,194,168,0.5)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)";
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }} />
                Ingresando...
              </>
            ) : (
              "Ingresar →"
            )}
          </button>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "20px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
              O continúa con
            </span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {/* SSO / Microsoft */}
          <button style={{
            width: "100%",
            padding: "11px",
            background: "#fff",
            color: "#374151",
            border: "1.5px solid #e2e8f0",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#00c2a8";
              (e.currentTarget as HTMLButtonElement).style.background = "#f0fdf4";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Iniciar con Microsoft
          </button>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          fontSize: 12,
          color: "rgba(255,255,255,0.65)",
          marginTop: 20,
          textShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}>
          © {new Date().getFullYear()} SoulForms · Todos los derechos reservados
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}