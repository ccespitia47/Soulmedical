import { useEffect, useRef } from "react";
import type { ExcelFieldMapping } from "../../../types/email-template.types";
import type { PlaceholderItem } from "./PlaceholdersList";

type Props = {
  html: string;
  css: string;
  mappings: Record<string, ExcelFieldMapping>;
  selectedPlaceholder: PlaceholderItem | null;
  customLogo: string | null;
  onCellClick: (coord: string, isMappable: boolean) => void;
  onRemoveMapping: (coord: string) => void;
};

/**
 * Renderiza el HTML fiel del Excel (generado por LibreOffice) dentro de un
 * shadow DOM para aislar los estilos de LibreOffice del resto del app.
 * Delegamos los clicks al contenedor y leemos `data-coord` del <td> para
 * decidir qué celda se mapeó.
 */
export default function ExcelHtmlTable({
  html,
  css,
  mappings,
  selectedPlaceholder,
  customLogo,
  onCellClick,
  onRemoveMapping,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);

  // Estilos de overlay para las celdas mapeadas / hover / mapeables. Se
  // inyectan DENTRO del shadow root — no colisionan con nada de afuera.
  const overlayCss = `
    :host { display: block; }
    .lo-wrapper { overflow: auto; background: #fff; padding: 8px; max-width: 100%; max-height: 65vh; }
    .lo-wrapper table { border-collapse: collapse; }
    td[data-mappable="true"] { cursor: crosshair; }
    td[data-mapped="true"] {
      outline: 2px solid #22c55e !important;
      outline-offset: -2px;
      background: rgba(34,197,94,0.10) !important;
      position: relative;
    }
    td[data-mapped="true"] .lo-mapping-badge {
      position: absolute; top: 0; right: 0; font-size: 9px; font-family: ui-monospace, Menlo, monospace;
      background: #bbf7d0; color: #14532d; padding: 1px 5px; border-bottom-left-radius: 4px; z-index: 2;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    td[data-mapped="true"] .lo-remove-btn {
      position: absolute; bottom: 0; right: 0; border: none; background: #ef4444; color: white;
      font-size: 9px; padding: 1px 6px; cursor: pointer; border-top-left-radius: 4px; z-index: 2;
    }
    td[data-mappable="true"]:not([data-mapped="true"]):hover {
      outline: 2px dashed #3b82f6 !important; outline-offset: -2px;
      background: rgba(59,130,246,0.06) !important;
    }
  `;

  // Montaje del shadow root — 1 sola vez. El HTML se re-inyecta con cada
  // cambio de html/css/mappings.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || shadowRef.current) return;
    shadowRef.current = host.attachShadow({ mode: "open" });
  }, []);

  useEffect(() => {
    const shadow = shadowRef.current;
    if (!shadow) return;

    // Si el admin cargó un logo custom, reemplazamos la PRIMERA <img> del
    // HTML de LibreOffice (típicamente el logo original del Excel). Si el
    // Excel no tenía <img> reconocida (por EMF), inyectamos el logo en la
    // celda A1 como fallback más adelante.
    let processedHtml = html;
    let logoReplaced = false;
    if (customLogo) {
      processedHtml = processedHtml.replace(
        /<img\b([^>]*?)\ssrc\s*=\s*(["'])[^"']*\2([^>]*)>/i,
        (_m, pre, _q, post) =>
          `<img${pre} src="${customLogo.replace(/"/g, "&quot;")}"${post}>`,
      );
      logoReplaced = /<img\b[^>]*src\s*=\s*["']?data:/i.test(processedHtml);
    }

    // Inyectar estilos de LibreOffice + overlay + wrapping.
    shadow.innerHTML = `
      <style>${css}\n${overlayCss}</style>
      <div class="lo-wrapper">${processedHtml}</div>
    `;

    // Marcar celdas ya mapeadas con badge + botón de quitar.
    const wrapper = shadow.querySelector(".lo-wrapper");
    if (!wrapper) return;

    // Fallback: si el Excel no tenía <img> (por logo EMF que LO no exporta),
    // inyectamos el customLogo en la primera celda que tiene data-coord="A1".
    if (customLogo && !logoReplaced) {
      const a1 = wrapper.querySelector<HTMLTableCellElement>('td[data-coord="A1"]');
      if (a1) {
        a1.innerHTML = `<img src="${customLogo}" style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:auto">`;
      }
    }
    for (const [coord, mapping] of Object.entries(mappings)) {
      const cell = wrapper.querySelector<HTMLTableCellElement>(
        `td[data-coord="${cssEscape(coord)}"]`,
      );
      if (!cell) continue;
      cell.setAttribute("data-mapped", "true");
      // Limpiar contenido y colocar solo el badge + botón (así no se ve
      // encimado con el contenido original de la celda vacía).
      cell.innerHTML = `
        <span class="lo-mapping-badge">${escapeHtml(mapping.placeholder)}</span>
        <button class="lo-remove-btn" data-remove="${cssEscape(coord)}" type="button">✕</button>
      `;
    }

    // Delegación de clicks en el wrapper.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const remove = target.closest<HTMLElement>("button[data-remove]");
      if (remove) {
        e.stopPropagation();
        onRemoveMapping(remove.getAttribute("data-remove") || "");
        return;
      }
      const cell = target.closest<HTMLTableCellElement>("td[data-coord]");
      if (!cell) return;
      const coord = cell.getAttribute("data-coord") || "";
      const isMappable = cell.getAttribute("data-mappable") === "true";
      onCellClick(coord, isMappable);
    };
    wrapper.addEventListener("click", onClick);
    return () => {
      wrapper.removeEventListener("click", onClick);
    };
  }, [html, css, mappings, overlayCss, onCellClick, onRemoveMapping, selectedPlaceholder, customLogo]);

  return <div ref={hostRef} />;
}

/** Escapa comillas y \ para uso como valor de selector CSS entre comillas. */
function cssEscape(v: string): string {
  return v.replace(/[\\"]/g, "\\$&");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
