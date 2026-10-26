export type RadioOption = {
  id: string;
  label: string;
  imageId?: string;
  imageUrl?: string;
};

/**
 * Convierte la config de opciones a shape actual. Los formularios viejos
 * guardaron `options: string[]`; los nuevos guardan `{id, label, imageId?,
 * imageUrl?}[]`. Nunca escribimos de vuelta el shape viejo — al primer
 * `updateWidget` el config queda con el shape moderno.
 */
export function normalizeRadioOptions(raw: unknown): RadioOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i): RadioOption => {
    if (typeof item === "string") {
      return { id: `opt_${i}_${item.slice(0, 6).replace(/\s+/g, "_")}`, label: item };
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      return {
        id: (o.id as string) || `opt_${i}`,
        label: (o.label as string) ?? String(o.value ?? ""),
        imageId: typeof o.imageId === "string" ? o.imageId : undefined,
        imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : undefined,
      };
    }
    return { id: `opt_${i}`, label: String(item) };
  });
}

export function newOptionId(): string {
  return `opt_${Math.random().toString(36).slice(2, 8)}`;
}
