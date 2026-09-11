// Shell genérico de formulario de consentimiento: header (logo/título/código
// desde `def.meta`), selector de entidad SOUL/SAI para los tipos
// multi-entidad, `ConsentRenderer`, vista previa PDF, envío y modales.
// Generaliza el antiguo formulario dedicado de vacunación para que cualquier
// `ConsentTipo` del registro (`definitions/index.ts`) use el mismo shell.

import { useEffect, useMemo, useState } from "react";
import { ENTITY_ORDER, ENTITIES, type EntityKey } from "./config";
import { getDefinition, type ConsentTipo } from "./definitions";
import ConsentRenderer from "./engine/ConsentRenderer";
import { useConsentSubmission } from "./engine/useConsentSubmission";
import { collectMissing, flattenConsent, buildEditState } from "./engine/consentState";
import { buildConsentPdf } from "./engine/buildConsentPdf";
import type { ConsentState } from "./engine/consentDefinition";
import { htmlToPdfBase64 } from "../../utils/pdfExporter";
import { getConsentPdfPayloadApi, type ConsentRecordDto } from "../../services/api";
import MissingFieldsModal from "../form/MissingFieldsModal";
import SuccessModal from "../form/SuccessModal";
import ConfirmModal from "../common/ConfirmModal";

type Props = {
  /** Tipo de consentimiento a renderizar (ver `CONSENT_TYPES`). */
  tipo: ConsentTipo;
  /** Vuelve al selector de Consientify (o a la vista de registros, en edición). */
  onBack?: () => void;
  /**
   * Registro existente a editar (Task 6, vista de registros). Cuando viene,
   * el formulario precarga su estado (identidad + respuestas + firmas/foto
   * desde GridFS) y el envío llama `updateConsentApi` en vez de crear uno
   * nuevo. La entidad SOUL/SAI queda fija a la del registro original.
   */
  editRecord?: ConsentRecordDto;
};

/** Tipos que distinguen entidad SOUL/SAI y muestran el selector del header. */
const MULTI_ENTIDAD_TIPOS: ConsentTipo[] = ["vacunacion", "vacunacion_b"];

const todayISO = () => new Date().toISOString().slice(0, 10);

const initialState = (): ConsentState => ({
  values: { fecha: todayISO() },
  firma: "",
  firmaResp: "",
  foto: "",
  accepted: false,
});

export default function ConsentForm({ tipo, onBack, editRecord }: Props) {
  const isEdit = !!editRecord;
  const isMultiEntidad = MULTI_ENTIDAD_TIPOS.includes(tipo);
  const [entityKey, setEntityKey] = useState<EntityKey>(() =>
    editRecord?.entidad === "SAI" ? "sai" : "soul",
  );
  const def = useMemo(() => getDefinition(tipo, entityKey), [tipo, entityKey]);

  const { submitConsent, submitting, emailStatus, emailError, submitError, done, reset } =
    useConsentSubmission(def, isEdit ? { editId: editRecord!.id } : undefined);

  const [state, setState] = useState<ConsentState>(isEdit ? { values: {}, firma: "", firmaResp: "", foto: "", accepted: false } : initialState);
  // Fuerza el remontaje del renderer (limpia firmas y tabla) al reiniciar o
  // cambiar de entidad, ya que esos controles guardan estado interno propio.
  const [remountKey, setRemountKey] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [pendingEntity, setPendingEntity] = useState<EntityKey | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [loadEditError, setLoadEditError] = useState<string | null>(null);

  // Modo edición: precarga el estado desde el registro guardado + los data
  // URLs de firmas/foto (viven en GridFS, no en el registro). Solo al montar
  // — `editRecord`/`tipo` no cambian durante la vida de este formulario.
  useEffect(() => {
    if (!editRecord) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await getConsentPdfPayloadApi(editRecord.id);
      if (cancelled) return;
      if (error || !data) {
        setLoadEditError(error ?? "No se pudo cargar el registro");
        setLoadingEdit(false);
        return;
      }
      setState(buildEditState(def, editRecord, data));
      setLoadingEdit(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (p: Partial<ConsentState>) => setState((prev) => ({ ...prev, ...p }));

  const hasData = useMemo(
    () =>
      Object.entries(state.values).some(([k, v]) => k !== "fecha" && v.trim() !== "") ||
      !!state.firma ||
      !!state.firmaResp,
    [state],
  );

  const doResetForm = () => {
    setState(initialState());
    setRemountKey((k) => k + 1);
    reset();
  };

  const requestEntityChange = (next: EntityKey) => {
    if (next === entityKey) return;
    if (hasData) {
      setPendingEntity(next);
      return;
    }
    setEntityKey(next);
    doResetForm();
  };

  const confirmEntityChange = () => {
    if (!pendingEntity) return;
    setEntityKey(pendingEntity);
    setPendingEntity(null);
    doResetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const miss = collectMissing(def, state);
    if (miss.length > 0) {
      setMissing(miss);
      return;
    }
    submitConsent(state);
  };

  const handleNew = () => doResetForm();

  // Genera el mismo PDF que se adjunta al correo y lo abre en una pestaña,
  // sin enviar nada. Útil para revisar el formato con lo diligenciado hasta ahora.
  const handlePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const flat = flattenConsent(def, state);
      const html = buildConsentPdf(def, flat);
      const base64 = await htmlToPdfBase64(html);
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      window.open(url, "_blank");
      // Liberar el objeto URL tras un margen para que la pestaña alcance a cargarlo.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Error generando la vista previa del consentimiento:", err);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] font-sans dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 py-3.5">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ← Volver
            </button>
          )}
          <img src={def.meta.logo} alt={def.meta.displayName} className="h-9 w-auto" />
          <div className="mr-auto">
            <h1 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
              {def.meta.titulo}
            </h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              {def.meta.entidadNombre} · {def.meta.codigo} v{def.meta.version}
            </p>
          </div>
          {isEdit && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Editando
            </span>
          )}
          {isMultiEntidad && !isEdit && (
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
              Entidad:
              <select
                value={entityKey}
                onChange={(e) => requestEntityChange(e.target.value as EntityKey)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {ENTITY_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {ENTITIES[k].meta.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loadingEdit ? (
        <div className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Cargando registro…
        </div>
      ) : loadEditError ? (
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            No se pudo cargar el registro para editar: {loadEditError}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-5 py-6">
          <ConsentRenderer key={`${entityKey}-${remountKey}`} definition={def} state={state} onChange={patch} />

          {submitError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <p className="m-0 font-semibold">No se pudo guardar el consentimiento</p>
              <p className="m-0 mt-0.5 text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="rounded-xl border-[1.5px] border-[#00c2a8] bg-transparent px-6 py-3.5 text-sm font-semibold text-[#00c2a8] transition-colors hover:bg-[#00c2a8]/5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {previewing ? "Generando…" : "Vista previa PDF"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-[#00c2a8] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,194,168,0.3)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Procesando…" : isEdit ? "Guardar cambios" : "Firmar y enviar consentimiento"}
            </button>
          </div>
        </form>
      )}

      {missing.length > 0 && <MissingFieldsModal fields={missing} onClose={() => setMissing([])} />}

      {pendingEntity && (
        <ConfirmModal
          title="Cambiar de entidad"
          message="Cambiar entre SOUL y SAI reiniciará el formulario y perderás lo diligenciado. ¿Continuar?"
          confirmLabel="Cambiar y reiniciar"
          confirmColor="#00c2a8"
          onCancel={() => setPendingEntity(null)}
          onConfirm={confirmEntityChange}
        />
      )}

      {done && (
        <SuccessModal
          emailStatus={emailStatus}
          emailError={emailError}
          onNewRegistration={isEdit ? onBack ?? handleNew : handleNew}
          onClose={onBack}
        />
      )}
    </div>
  );
}
