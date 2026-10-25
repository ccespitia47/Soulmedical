// Punto de montaje de Consientify. El marco (`ConsientifyShell`) es quien pone
// el riel, el fondo y las dos vistas; aquí solo se le pasa lo que viene de la
// ruta: el usuario conectado y el cierre de sesión.
//
// La portada con fichas desapareció: el riel es la navegación, así que no había
// un camino que la portada diera y el riel no. Lo que sí vivía solo ahí —el
// botón de doble verificación— se movió al menú de usuario del riel.

import ConsientifyShell from "../components/consents/shell/ConsientifyShell";

type ConsientifyProps = {
  onLogout: () => void;
  usuario: { name?: string } | null;
};

export default function Consientify({ onLogout, usuario }: ConsientifyProps) {
  return <ConsientifyShell usuario={usuario} onLogout={onLogout} />;
}
