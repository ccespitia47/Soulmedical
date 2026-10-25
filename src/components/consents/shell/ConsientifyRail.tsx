// Riel de iconos de Consientify: la navegación permanente del módulo.
//
// Sustituye al "← Volver" y a la portada, así que es la única salida de una
// vista. Abajo vive el menú de usuario, que además de cerrar sesión es el
// ÚNICO acceso a la doble verificación para alguien que solo tiene permiso de
// Consientify: los otros montajes de MyTwoFactorButton están en AdminSidebar y
// UserAppPage, inalcanzables para ese usuario.

import { useEffect, useRef, useState } from "react";
import Icon from "../../common/Icon";
import MyTwoFactorButton from "../../auth/MyTwoFactorButton";
import { useTheme } from "../../../context/ThemeContext";

export type Vista = "consentimientos" | "registros";

type Props = {
  vista: Vista;
  onVista: (v: Vista) => void;
  usuario: { name?: string } | null;
  onLogout: () => void;
};

const ACENTO = "#00c2a8";

const DESTINOS: { vista: Vista; icono: string; etiqueta: string }[] = [
  { vista: "consentimientos", icono: "clipboard", etiqueta: "Consentimientos" },
  { vista: "registros", icono: "table", etiqueta: "Registros" },
];

const botonCls =
  "flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent transition-colors";

export default function ConsientifyRail({ vista, onVista, usuario, onLogout }: Props) {
  const { theme, setTheme } = useTheme();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cajaMenu = useRef<HTMLDivElement>(null);

  // Un menú que no se cierra al pinchar fuera se queda tapando el formulario.
  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: MouseEvent) => {
      if (!cajaMenu.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [menuAbierto]);

  // `midnight` también se considera oscuro: el primer clic desde ahí lleva a claro.
  const esOscuro = theme !== "light";
  const iniciales = (usuario?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <nav
      aria-label="Secciones de Consientify"
      className="sticky top-0 z-30 flex h-screen w-[60px] shrink-0 flex-col items-center gap-2 self-start border-r border-slate-200 bg-white/70 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
    >
      {DESTINOS.map((d) => {
        const activo = d.vista === vista;
        return (
          <button
            key={d.vista}
            type="button"
            title={d.etiqueta}
            aria-label={d.etiqueta}
            aria-current={activo ? "page" : undefined}
            onClick={() => onVista(d.vista)}
            className={`${botonCls} ${
              activo
                ? "bg-[#00c2a8]/15 text-[#0f766e] dark:text-[#2dd4bf]"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            style={activo ? { boxShadow: `inset 0 0 0 1.5px ${ACENTO}` } : undefined}
          >
            <Icon name={d.icono} size={20} />
          </button>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          title={esOscuro ? "Tema claro" : "Tema oscuro"}
          onClick={() => setTheme(esOscuro ? "light" : "dark")}
          className={`${botonCls} text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800`}
        >
          <Icon name={esOscuro ? "sun" : "moon"} size={18} />
        </button>

        <div className="relative" ref={cajaMenu}>
          <button
            type="button"
            aria-label="Abrir menú de usuario"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((v) => !v)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none text-[13px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACENTO}, #2dd4bf)` }}
          >
            {iniciales}
          </button>

          {menuAbierto && (
            <div
              role="menu"
              className="absolute bottom-0 left-[46px] w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              {usuario?.name && (
                <p className="m-0 mb-2 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  {usuario.name}
                </p>
              )}
              <MyTwoFactorButton />
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
