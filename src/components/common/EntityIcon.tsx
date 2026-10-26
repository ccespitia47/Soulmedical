import Icon, { hasIcon } from "./Icon";
import { getColombiaIcon, isColombiaIconId } from "../../types/colombia-icons";

/**
 * Mapa de compatibilidad: iconos antiguos (emoji) guardados en proyectos,
 * carpetas y plantillas ya existentes → nombre del icono SVG equivalente.
 * Los proyectos/carpetas nuevos ya guardan directamente la clave SVG.
 */
const LEGACY_EMOJI: Record<string, string> = {
  "🏢": "building",
  "💰": "wallet",
  "📊": "chart",
  "🏥": "health",
  "👥": "users",
  "⚙️": "settings",
  "⚙": "settings",
  "📦": "package",
  "🎯": "target",
  "📁": "folder",
  "📋": "clipboard",
  "📝": "fileText",
  // Emojis que ofrecía el selector de grupos (compat con grupos ya creados).
  "💼": "package",
  "🔬": "health",
  "💊": "health",
  "🧑‍💻": "users",
  "🩺": "health",
  "🏷️": "tag",
  "🏷": "tag",
};

/** Resuelve un valor de icono guardado (emoji legado o clave) a un nombre SVG.
 *  Nota: ids con prefijo `ci:` (Colombia Icons) NO pasan por aquí — el
 *  componente EntityIcon los renderiza directo. */
export function resolveIconName(value: string | undefined | null): string {
  if (!value) return "folder";
  if (isColombiaIconId(value)) return value; // preservar id ci: tal cual
  if (LEGACY_EMOJI[value]) return LEGACY_EMOJI[value];
  if (hasIcon(value)) return value;
  return "folder";
}

type EntityIconProps = {
  icon: string | undefined | null;
  size?: number;
  className?: string;
};

/** Icono SVG para proyectos / carpetas / plantillas (retrocompatible).
 *  Soporta tres fuentes:
 *   - "ci:ComponentName" → componente de @mteherandev/colombia-icons-react.
 *   - Emoji legado (🏢, 📁, …) → mapeado a la clave SVG interna.
 *   - Clave del Icon.tsx interno ("folder", "clipboard", …).
 */
export default function EntityIcon({ icon, size = 16, className }: EntityIconProps) {
  if (isColombiaIconId(icon)) {
    const entry = getColombiaIcon(icon);
    if (entry) {
      const Comp = entry.Component;
      return <Comp size={size} className={className} />;
    }
    // id ci: inválido (quedó un componente removido en upgrade de la librería)
    // → caemos al default "folder" para no romper el render.
  }
  return <Icon name={resolveIconName(icon)} size={size} className={className} />;
}
