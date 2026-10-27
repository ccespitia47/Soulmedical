import { useState } from "react";
import type { WidgetInstance } from "../../../types/widget.types";
import type { EmailRecipient } from "../../../types/email-template.types";
import { fetchSheetsHeaders } from "../../widgets/search/sources/googleSheets";
import { randomUUID } from "../../../utils/uuid";

type Props = {
  widgets: WidgetInstance[];
  onAdd: (newRecipients: EmailRecipient[]) => void;
  onClose: () => void;
  /** Si se pasa, el modal arranca con ese widget preseleccionado (p. ej.
   *  cuando el admin clickeó un widget en el dropdown de destinatarios). */
  initialWidgetId?: string;
};

type Step = "config" | "loaded";

/**
 * Modal de configuración de "lookup externo":
 *
 *   1. Elegir widget del formulario que aporta el valor de match
 *      (desplegable, texto, email, search, lo que sea).
 *   2. Pegar URL de un Google Sheet aparte.
 *   3. Cargar headers del Sheet.
 *   4. Elegir qué columna es la de match + marcar qué columnas son correos.
 *   5. "Agregar": crea N recipients tipo `lookup`, uno por columna de correo
 *      marcada. Al enviar el formulario, el navegador buscará la fila donde
 *      row[matchColumn] === valorDelWidget y tomará los correos.
 */
export default function LookupConfigModal({
  widgets,
  onAdd,
  onClose,
  initialWidgetId,
}: Props) {
  const [widgetId, setWidgetId] = useState<string>(initialWidgetId ?? "");
  const [sheetUrl, setSheetUrl] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [matchColumn, setMatchColumn] = useState("");
  const [emailCols, setEmailCols] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("config");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetLabel = (w: WidgetInstance) =>
    w.label || (w.config?.placeholder as string | undefined) || w.id;

  // Mostramos todos los widgets elegibles como fuente de "match". Dejamos
  // afuera los decorativos (header, htmlblock, image, etc.) y los compuestos
  // (subform) que no aportan un valor escalar al formData.
  const eligibleWidgets = widgets.filter((w) =>
    [
      "select",
      "text",
      "email",
      "phone",
      "number",
      "search",
      "radio",
      "date",
    ].includes(w.type),
  );

  const loadHeaders = async () => {
    if (!sheetUrl.trim()) {
      setError("Pega la URL del Google Sheet primero");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cols = await fetchSheetsHeaders(sheetUrl.trim());
      if (cols.length === 0) {
        setError("El Sheet no devolvió columnas. ¿Está publicado?");
        setLoading(false);
        return;
      }
      setHeaders(cols);
      setStep("loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el Sheet");
    } finally {
      setLoading(false);
    }
  };

  const toggleEmailCol = (col: string) => {
    setEmailCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleAdd = () => {
    if (!widgetId) {
      setError("Elige el widget que da el valor a Relacionar");
      return;
    }
    if (!matchColumn) {
      setError("Elige la Columna a Relacionar");
      return;
    }
    if (emailCols.length === 0) {
      setError("Marca al menos una columna de correo");
      return;
    }
    const w = widgets.find((x) => x.id === widgetId);
    const wLabel = w ? widgetLabel(w) : widgetId;
    const newOnes: EmailRecipient[] = emailCols.map((col) => ({
      id: randomUUID(),
      type: "lookup",
      widgetId,
      // Formato estilo MoreApp: "widget.columna" sin flecha.
      widgetLabel: `${wLabel}.${col}`,
      sheetUrl: sheetUrl.trim(),
      matchColumn,
      emailColumn: col,
    }));
    onAdd(newOnes);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[550] flex items-center justify-center bg-black/60 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="m-0 text-base font-bold text-gray-900">
              🔗 Lookup externo (Google Sheet)
            </h3>
            <p className="m-0 mt-0.5 text-[12px] text-gray-500">
              Busca los correos en un Sheet aparte usando el valor que el usuario eligió en un widget.
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
          {/* 1. Widget que da el valor */}
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-gray-500">
            1. Widget que da el valor a Relacionar
          </label>
          <select
            value={widgetId}
            onChange={(e) => setWidgetId(e.target.value)}
            className="mb-4 w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8]"
          >
            <option value="">— Selecciona un widget —</option>
            {eligibleWidgets.map((w) => (
              <option key={w.id} value={w.id}>
                {widgetLabel(w)} ({w.type})
              </option>
            ))}
          </select>

          {/* 2. URL del Sheet */}
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-gray-500">
            2. URL del Google Sheet
          </label>
          <div className="mb-4 flex gap-2">
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => {
                setSheetUrl(e.target.value);
                if (step === "loaded") {
                  setStep("config");
                  setHeaders([]);
                  setMatchColumn("");
                  setEmailCols([]);
                }
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8]"
            />
            <button
              type="button"
              onClick={loadHeaders}
              disabled={loading || !sheetUrl.trim()}
              className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Cargar columnas"}
            </button>
          </div>

          {/* 3 & 4: solo cuando ya cargamos headers */}
          {step === "loaded" && (
            <>
              <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-gray-500">
                3. Columna a Relacionar (contra qué compara el valor del widget)
              </label>
              <select
                value={matchColumn}
                onChange={(e) => setMatchColumn(e.target.value)}
                className="mb-4 w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8]"
              >
                <option value="">— Selecciona una columna —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-gray-500">
                4. Columnas de correo (marca las que son correos)
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                {headers.map((h) => {
                  const selected = emailCols.includes(h);
                  return (
                    <label
                      key={h}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-white"
                      style={{ background: selected ? "#fef3c7" : "transparent" }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleEmailCol(h)}
                      />
                      <span className="font-mono text-[12.5px] text-gray-700">{h}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-[12px] text-gray-500">
            {emailCols.length} columna{emailCols.length === 1 ? "" : "s"} de correo
            {step === "loaded" ? " marcada(s)" : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={emailCols.length === 0 || !widgetId || !matchColumn}
              className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agregar {emailCols.length > 0 ? `(${emailCols.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
