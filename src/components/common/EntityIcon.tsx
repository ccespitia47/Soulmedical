import Icon, { hasIcon } from "./Icon";

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
};

/** Resuelve un valor de icono guardado (emoji legado o clave) a un nombre SVG. */
export function resolveIconName(value: string | undefined | null): string {
  if (!value) return "folder";
  if (LEGACY_EMOJI[value]) return LEGACY_EMOJI[value];
  if (hasIcon(value)) return value;
  return "folder";
}

type EntityIconProps = {
  icon: string | undefined | null;
  size?: number;
  className?: string;
};

/** Icono SVG para proyectos / carpetas / plantillas (retrocompatible). */
export default function EntityIcon({ icon, size = 16, className }: EntityIconProps) {
  return <Icon name={resolveIconName(icon)} size={size} className={className} />;
}
