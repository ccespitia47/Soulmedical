import { useEffect, useRef, useState } from "react";
import type { WidgetInstance } from "../../../types/widget.types";
import type { EmailRecipient } from "../../../types/email-template.types";
import { fetchSheetsHeaders } from "../../widgets/search/sources/googleSheets";
import { randomUUID } from "../../../utils/uuid";
import LookupConfigModal from "./LookupConfigModal";

type Props = {
  widgets: WidgetInstance[];
  recipients: EmailRecipient[];
  onChange: (next: EmailRecipient[]) => void;
  onClose: () => void;
};

type HeaderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; headers: string[] }
  | { status: "error"; message: string };

type LookupGroup = {
  sheetUrl: string;
  widgetId: string;
  widgetLabel: string;
  matchColumn: string;
  /** Columnas de este Sheet que ya están como chip (recipients activos). */
  selectedColumns: Set<string>;
};

/**
 * Modal "Ver campos" rediseñado: lista las COLUMNAS reales del Google Sheet
 * de cada lookup externo ya configurado. El admin marca con checkbox cuáles
 * columnas usar como destinatarios. Si no hay ningún lookup configurado,
 * muestra un mensaje + botón para crear el primero.
 */
export default function AvailableFieldsModal({
  widgets,
  recipients,
  onChange,
  onClose,
}: Props) {
  const [headers, setHeaders] = useState<Record<string, HeaderState>>({});
  const [showLookup, setShowLookup] = useState(false);
  // Ref siempre actualizada con los recipients. Evita stale closures al
  // agregar un SEGUNDO lookup: antes, el callback `onAdd` del segundo modal
  // capturaba la lista vieja y pisaba el primero. Ahora el callback lee
  // SIEMPRE el ref para armar la lista final.
  const recipientsRef = useRef(recipients);
  useEffect(() => {
    recipientsRef.current = recipients;
  }, [recipients]);

  // Agrupo todos los recipients tipo `lookup` por combinación
  // (sheetUrl + widgetId + matchColumn). Dos lookups que apunten al mismo
  // Sheet PERO desde widgets distintos (o con otra columna de match) son
  // configuraciones conceptualmente distintas → dos grupos separados.
  // Antes agrupaba solo por sheetUrl y el segundo lookup se "fundía" en el
  // primero cuando reusaban el mismo Sheet.
  const groups: LookupGroup[] = [];
  const byKey = new Map<string, LookupGroup>();
  for (const r of recipients) {
    if (r.type !== "lookup" || !r.sheetUrl || !r.widgetId || !r.matchColumn) continue;
    const key = `${r.sheetUrl}::${r.widgetId}::${r.matchColumn}`;
    let g = byKey.get(key);
    if (!g) {
      const w = widgets.find((x) => x.id === r.widgetId);
      const widgetLabel =
        w?.label || (w?.config?.placeholder as string | undefined) || r.widgetId;
      g = {
        sheetUrl: r.sheetUrl,
        widgetId: r.widgetId,
        widgetLabel,
        matchColumn: r.matchColumn,
        selectedColumns: new Set<string>(),
      };
      byKey.set(key, g);
      groups.push(g);
    }
    if (r.emailColumn) g.selectedColumns.add(r.emailColumn);
  }

  // Carga perezosa de los headers de cada Sheet.
  useEffect(() => {
    for (const g of groups) {
      if (headers[g.sheetUrl]) continue;
      setHeaders((p) => ({ ...p, [g.sheetUrl]: { status: "loading" } }));
      fetchSheetsHeaders(g.sheetUrl)
        .then((cols) =>
          setHeaders((p) => ({
            ...p,
            [g.sheetUrl]: { status: "ready", headers: cols },
          })),
        )
        .catch((e) =>
          setHeaders((p) => ({
            ...p,
            [g.sheetUrl]: {
              status: "error",
              message:
                e instanceof Error ? e.message : "No se pudo cargar el Sheet",
            },
          })),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients]);

  const sameGroup = (r: EmailRecipient, g: LookupGroup) =>
    r.type === "lookup" &&
    r.sheetUrl === g.sheetUrl &&
    r.widgetId === g.widgetId &&
    r.matchColumn === g.matchColumn;

  const toggleColumn = (g: LookupGroup, col: string) => {
    if (g.selectedColumns.has(col)) {
      // Quitar: filtrar el recipient que tenga este sheet+widget+match+col.
      onChange(
        recipients.filter((r) => !(sameGroup(r, g) && r.emailColumn === col)),
      );
    } else {
      // Agregar: nuevo chip tipo lookup con misma config del grupo.
      onChange([
        ...recipients,
        {
          id: randomUUID(),
          type: "lookup",
          widgetId: g.widgetId,
          widgetLabel: `${g.widgetLabel}.${col}`,
          sheetUrl: g.sheetUrl,
          matchColumn: g.matchColumn,
          emailColumn: col,
        },
      ]);
    }
  };

  const removeGroup = (g: LookupGroup) => {
    onChange(recipients.filter((r) => !sameGroup(r, g)));
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="m-0 text-base font-bold text-gray-900">
              🔎 Columnas del Google Sheet
            </h3>
            <p className="m-0 mt-0.5 text-[12px] text-gray-500">
              Marca las columnas que querés usar como destinatarios de email.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-sm text-slate-500"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Botón para configurar nuevo lookup — siempre disponible */}
          <button
            type="button"
            onClick={() => setShowLookup(true)}
            className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-cyan-500 bg-cyan-50/50 px-4 py-3 text-left hover:bg-cyan-50"
          >
            <span className="text-xl">🔗</span>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-cyan-800">
                {groups.length === 0
                  ? "Agregar destinatarios desde un Google Sheet"
                  : "Agregar otro Google Sheet"}
              </div>
              <div className="text-[11.5px] text-cyan-700">
                Elegís un widget que da un valor y el Sheet donde buscar los correos.
              </div>
            </div>
            <span className="text-cyan-600">➕</span>
          </button>

          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-500">
              Todavía no hay ningún Google Sheet configurado.
              <br />
              Hacé clic en el botón de arriba para configurar uno.
            </div>
          )}

          {groups.map((g) => {
            const h = headers[g.sheetUrl];
            return (
              <div
                key={g.sheetUrl}
                className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <span className="text-base">🔗</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900">
                      Relacionar: <span className="font-mono">{g.widgetLabel}</span>{" "}
                      ↔{" "}
                      <span className="font-mono text-cyan-700">
                        {g.matchColumn}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-gray-400">
                      {g.sheetUrl}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGroup(g)}
                    className="shrink-0 cursor-pointer rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                    title="Quitar todos los chips de este Sheet"
                  >
                    Quitar Sheet
                  </button>
                </div>

                <div className="px-4 py-3">
                  {h?.status === "loading" && (
                    <div className="py-3 text-center text-[12px] text-slate-400">
                      Cargando columnas…
                    </div>
                  )}
                  {h?.status === "error" && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                      No se pudo cargar: {h.message}
                    </div>
                  )}
                  {h?.status === "ready" && h.headers.length === 0 && (
                    <div className="py-3 text-center text-[12px] text-slate-400">
                      El Sheet no devolvió columnas.
                    </div>
                  )}
                  {h?.status === "ready" &&
                    h.headers.map((col) => {
                      const selected = g.selectedColumns.has(col);
                      const isMatch = col === g.matchColumn;
                      return (
                        <label
                          key={col}
                          className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${
                            isMatch
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer hover:bg-slate-50"
                          }`}
                          style={{
                            background: selected ? "#fef3c7" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={isMatch}
                            onChange={() => !isMatch && toggleColumn(g, col)}
                          />
                          <span className="font-mono text-[12.5px] text-gray-700">
                            {col}
                          </span>
                          {isMatch && (
                            <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              RELACIONAR
                            </span>
                          )}
                          {selected && !isMatch && (
                            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              SELECCIONADO
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-[12px] text-gray-500">
            {recipients.filter((r) => r.type === "lookup").length} columna
            {recipients.filter((r) => r.type === "lookup").length === 1 ? "" : "s"}{" "}
            marcada(s) como destinatario
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,194,168,0.3)]"
          >
            Listo
          </button>
        </div>
      </div>

      {showLookup && (
        <LookupConfigModal
          widgets={widgets}
          onAdd={(newOnes) => onChange([...recipientsRef.current, ...newOnes])}
          onClose={() => setShowLookup(false)}
        />
      )}
    </div>
  );
}
