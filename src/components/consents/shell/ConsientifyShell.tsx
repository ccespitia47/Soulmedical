// Marco de Consientify: riel permanente, fondo animado y las dos vistas.
//
// Las DOS vistas se montan siempre y se alterna cuál se ve con el atributo
// `hidden`. No se usa un conmutador de rutas que desmonte la inactiva: eso
// tiraría el formulario a medio diligenciar al saltar a Registros, y
// conservarlo es lo que el usuario pidió expresamente.
//
// La vista activa vive en la URL (`/consientify/:vista`) para que el botón
// Atrás y recargar funcionen: al quitar el "← Volver", el riel es la única
// navegación dentro del módulo.

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConsentimientosPage from "../../../pages/ConsentimientosPage";
import ConsentRecordsPage from "../records/ConsentRecordsPage";
import ConsientifyBackground from "./ConsientifyBackground";
import ConsientifyRail, { type Vista } from "./ConsientifyRail";
import { fondoAnimadoPorDefecto, recordarFondoAnimado } from "./fondoParams";

type Props = {
  usuario: { name?: string } | null;
  onLogout: () => void;
};

const VISTAS: Vista[] = ["consentimientos", "registros"];
const POR_DEFECTO: Vista = "consentimientos";

export default function ConsientifyShell({ usuario, onLogout }: Props) {
  const navigate = useNavigate();
  const { vista: enRuta } = useParams<{ vista?: string }>();
  const vista: Vista = VISTAS.includes(enRuta as Vista) ? (enRuta as Vista) : POR_DEFECTO;

  // El ajuste del sistema decide el valor inicial; el interruptor del riel lo
  // sobrescribe y se recuerda.
  const [fondoAnimado, setFondoAnimado] = useState(fondoAnimadoPorDefecto);
  const cambiarFondo = (v: boolean) => {
    setFondoAnimado(v);
    recordarFondoAnimado(v);
  };

  return (
    <div className="relative flex min-h-screen font-sans">
      <ConsientifyBackground animado={fondoAnimado} />
      {/* `sticky` y no `fixed`: el riel sigue ocupando su columna en el flex,
          así que el contenido no queda debajo, pero no se va con el scroll. */}
      <ConsientifyRail
        vista={vista}
        onVista={(v) => navigate(`/consientify/${v}`)}
        usuario={usuario}
        fondoAnimado={fondoAnimado}
        onFondoAnimado={cambiarFondo}
        onLogout={onLogout}
      />
      <main className="relative z-10 min-w-0 flex-1">
        <div data-testid="vista-consentimientos" hidden={vista !== "consentimientos"}>
          <ConsentimientosPage />
        </div>
        <div data-testid="vista-registros" hidden={vista !== "registros"}>
          <ConsentRecordsPage activa={vista === "registros"} />
        </div>
      </main>
    </div>
  );
}
