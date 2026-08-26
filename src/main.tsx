import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import GlobalErrorBoundary from "./components/common/GlobalErrorBoundary";
import "./index.css";

// Migración: el viejo useUsersStore persistía contraseñas en localStorage.
// La nueva versión es solo caché en memoria. Limpiamos cualquier residuo.
try {
  localStorage.removeItem("soulforms-users");
} catch {
  // ignore
}

// Captura errores JS globales y promises rechazadas sin handler. Logea a
// console (visible en Safari devtools remotos) — no dispatch a backend.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    console.error("[global error]", e.message, e.filename, e.lineno, e.colno, e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[unhandled rejection]", e.reason);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
