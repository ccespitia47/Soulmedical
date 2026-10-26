import type { ComponentType, SVGProps } from "react";
import * as CI from "@mteherandev/colombia-icons-react";

/**
 * Integración de la librería @mteherandev/colombia-icons-react al catálogo
 * de íconos de la app. Los ícones existentes (FOLDER_ICONS, PROJECT_ICONS,
 * GROUP_ICONS) NO se tocan — este archivo solo AGREGA.
 *
 * Formato del id guardado en la BD cuando se elige uno de esta librería:
 *   "ci:ComponentName"   ej. "ci:BandejaPaisa", "ci:Carpeta"
 *
 * El prefijo `ci:` lo lee EntityIcon para decidir si delega a esta librería
 * o al Icon.tsx interno. Los ids sin prefijo (ej. "folder") siguen siendo
 * del sistema viejo.
 */

type IconProps = {
  size?: number | string;
  color?: string;
} & SVGProps<SVGSVGElement>;

export type ColombiaIconComponent = ComponentType<IconProps>;

export type ColombiaIconEntry = {
  /** Id tal como se guarda en la BD, con prefijo `ci:`. */
  id: string;
  /** Nombre PascalCase del componente, sin prefijo. */
  componentName: string;
  /** Label legible para el buscador y el tooltip del picker. */
  label: string;
  Component: ColombiaIconComponent;
};

/** PascalCase → "Pascal Case" (para los labels del catálogo). */
function toLabel(pascal: string): string {
  return pascal
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Catálogo completo (todos los exports válidos de la librería). */
export const COLOMBIA_ICONS: ColombiaIconEntry[] = Object.entries(
  CI as unknown as Record<string, unknown>,
)
  .filter(([name, val]) => {
    if (typeof name !== "string") return false;
    if (!/^[A-Z]/.test(name)) return false;
    // forwardRef devuelve un objeto, no una función; aceptamos ambos.
    return typeof val === "function" || typeof val === "object";
  })
  .map(([name, Component]) => ({
    id: `ci:${name}`,
    componentName: name,
    label: toLabel(name),
    Component: Component as ColombiaIconComponent,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

const BY_ID: Record<string, ColombiaIconEntry> = Object.fromEntries(
  COLOMBIA_ICONS.map((e) => [e.id, e]),
);

/** Resuelve un id `ci:XXX` a su entrada, o undefined si no existe. */
export function getColombiaIcon(id: string | undefined | null): ColombiaIconEntry | undefined {
  if (!id) return undefined;
  return BY_ID[id];
}

/** True si el id corresponde a esta librería (prefijo `ci:`). */
export function isColombiaIconId(id: string | undefined | null): boolean {
  return typeof id === "string" && id.startsWith("ci:");
}
