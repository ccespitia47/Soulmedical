import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import "./index.css";

// Migración: el viejo useUsersStore persistía contraseñas en localStorage.
// La nueva versión es solo caché en memoria. Limpiamos cualquier residuo.
try {
  localStorage.removeItem("soulforms-users");
} catch {
  // ignore
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
