import { useEffect, useRef } from "react";
import type { ExcelFieldMapping } from "../../../types/email-template.types";
import type { PlaceholderItem } from "./PlaceholdersList";

type Props = {
  html: string;
  css: string;
  mappings: Record<string, ExcelFieldMapping>;
  selectedPlaceholder: PlaceholderItem | null;
  customLogo: string | null;
  /**
   * `existingText` es el textContent de la celda ANTES del click — se usa
   * para construir el template cuando ya hay texto fijo ("Nombre: " +
   * ${chip} → "Nombre: ${nombrePaciente}"). Vacío si la celda está vacía
   * o si la celda ya estaba mapeada (ahí no hay texto real sino el badge).
   */
  onCellClick: (coord: string, isMappable: boolean, existingText: string) => void;
  onRemoveMapping: (coord: string) => void;
  /** Opcional: si está definido, un doble-click en una celda sin mapear
   *  habilita edición in-place de su texto. Al blur / Enter se dispara
   *  con el texto nuevo. Escape cancela y restaura el original. */
  onCellEdit?: (coord: string, newText: string) => void;
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
  onCellEdit,
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
    td[data-editing="true"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: -2px;
      background: rgba(245,158,11,0.08) !important;
      cursor: text;
      caret-color: #0f172a;
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
      // Mostramos el template completo cuando existe ("Nombre: ${nombrePaciente}")
      // para que el admin vea exactamente lo que va a quedar en la celda. Si
      // no hay template (mappings legacy), caemos al placeholder suelto.
      const badgeText = mapping.template ?? mapping.placeholder;
      cell.innerHTML = `
        <span class="lo-mapping-badge">${escapeHtml(badgeText)}</span>
        <button class="lo-remove-btn" data-remove="${cssEscape(coord)}" type="button">✕</button>
      `;
    }

    // Delegación de clicks en el wrapper. Si la celda está en modo
    // edición (data-editing="true"), ignoramos el click para no gatillar
    // mapeo mientras el user escribe.
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
      if (cell.getAttribute("data-editing") === "true") return;
      const coord = cell.getAttribute("data-coord") || "";
      const isMappable = cell.getAttribute("data-mappable") === "true";
      // Si la celda ya tiene mapping, el DOM muestra el badge — no es texto
      // real del Excel. En ese caso pasamos string vacío y el caller ignora
      // el click igual (ya hay mapping). Para celdas sin mapping, textContent
      // es el texto literal que LibreOffice renderizó.
      const isMapped = cell.getAttribute("data-mapped") === "true";
      const existingText = isMapped ? "" : (cell.textContent ?? "").trim();
      onCellClick(coord, isMappable, existingText);
    };
    wrapper.addEventListener("click", onClick);

    // Doble-click = modo edición in-place. Solo para celdas mappables y
    // NO mapeadas (una celda mapeada muestra un badge, no el texto real
    // del Excel — editarlo no tiene sentido). Guarda el texto original
    // en data-original; Escape lo restaura.
    const onDblClick = (e: Event) => {
      if (!onCellEdit) return;
      const target = e.target as HTMLElement;
      const cell = target.closest<HTMLTableCellElement>("td[data-coord]");
      if (!cell) return;
      if (cell.getAttribute("data-mapped") === "true") return;
      if (cell.getAttribute("data-mappable") !== "true") return;
      if (cell.getAttribute("data-editing") === "true") return;
      e.preventDefault();
      cell.setAttribute("data-original", cell.textContent ?? "");
      cell.setAttribute("data-editing", "true");
      cell.setAttribute("contenteditable", "plaintext-only");
      // plaintext-only no está soportado en todos los browsers; fallback a true.
      if (cell.contentEditable !== "plaintext-only") {
        cell.setAttribute("contenteditable", "true");
      }
      // Focus + seleccionar todo el texto para que el user tipee y reemplace.
      cell.focus();
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(cell);
          sel.addRange(range);
        }
      } catch { /* selection no disponible: focus funciona igual */ }
    };
    wrapper.addEventListener("dblclick", onDblClick);

    const commitEdit = (cell: HTMLTableCellElement) => {
      const coord = cell.getAttribute("data-coord") ?? "";
      const original = cell.getAttribute("data-original") ?? "";
      const next = (cell.textContent ?? "").trim();
      cell.removeAttribute("data-editing");
      cell.removeAttribute("data-original");
      cell.removeAttribute("contenteditable");
      if (next === original.trim()) return; // nada cambió
      if (onCellEdit) onCellEdit(coord, next);
    };

    const cancelEdit = (cell: HTMLTableCellElement) => {
      const original = cell.getAttribute("data-original") ?? "";
      cell.textContent = original;
      cell.removeAttribute("data-editing");
      cell.removeAttribute("data-original");
      cell.removeAttribute("contenteditable");
    };

    // focusout burbujea; blur no. Delegamos en el wrapper.
    const onFocusOut = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute && target.getAttribute("data-editing") === "true") {
        commitEdit(target as HTMLTableCellElement);
      }
    };
    wrapper.addEventListener("focusout", onFocusOut);

    const onKeyDown = (e: Event) => {
      const kev = e as KeyboardEvent;
      const target = e.target as HTMLElement;
      if (!target.getAttribute || target.getAttribute("data-editing") !== "true") return;
      if (kev.key === "Enter" && !kev.shiftKey) {
        kev.preventDefault();
        (target as HTMLTableCellElement).blur();
      } else if (kev.key === "Escape") {
        kev.preventDefault();
        cancelEdit(target as HTMLTableCellElement);
      }
    };
    wrapper.addEventListener("keydown", onKeyDown);

    return () => {
      wrapper.removeEventListener("click", onClick);
      wrapper.removeEventListener("dblclick", onDblClick);
      wrapper.removeEventListener("focusout", onFocusOut);
      wrapper.removeEventListener("keydown", onKeyDown);
    };
  }, [html, css, mappings, overlayCss, onCellClick, onRemoveMapping, onCellEdit, selectedPlaceholder, customLogo]);

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
