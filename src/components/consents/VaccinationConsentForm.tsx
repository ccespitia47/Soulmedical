import { useMemo, useState } from "react";
import { getEntityConfig, ENTITY_ORDER, ENTITIES, type EntityKey } from "./config";
import { useVaccinationConsent } from "./useVaccinationConsent";
import { collectMissing, flattenConsent } from "./flattenConsent";
import { buildVaccinationConsentHtml } from "./vaccinationConsentPdf";
import { htmlToPdfBase64 } from "../../utils/pdfExporter";
import GeneralDataSection from "./sections/GeneralDataSection";
import SectionA from "./sections/SectionA";
import SectionB from "./sections/SectionB";
import LiveVaccinesSection from "./sections/LiveVaccinesSection";
import SectionC from "./sections/SectionC";
import LegalSection from "./sections/LegalSection";
import MissingFieldsModal from "../form/MissingFieldsModal";
import SuccessModal from "../form/SuccessModal";
import ConfirmModal from "../common/ConfirmModal";

type Props = {
  /** Vuelve al inicio de Consientify. */
  onBack?: () => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function VaccinationConsentForm({ onBack }: Props) {
  const { submitConsent, submitting, emailStatus, emailError, done, reset } = useVaccinationConsent();

  const [entityKey, setEntityKey] = useState<EntityKey>("soul");
  const config = useMemo(() => getEntityConfig(entityKey), [entityKey]);

  const [values, setValues] = useState<Record<string, string>>({ fecha: todayISO() });
  const [firma, setFirma] = useState("");
  const [firmaResp, setFirmaResp] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [pendingEntity, setPendingEntity] = useState<EntityKey | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const hasData = useMemo(
    () => Object.entries(values).some(([k, v]) => k !== "fecha" && v.trim() !== "") || !!firma || !!firmaResp,
    [values, firma, firmaResp],
  );

  const doResetForm = () => {
    setValues({ fecha: todayISO() });
    setFirma("");
    setFirmaResp("");
    setAccepted(false);
    setResetKey((k) => k + 1);
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
    const miss = collectMissing(config, { values, firma, firmaResp, accepted });
    if (miss.length > 0) {
      setMissing(miss);
      return;
    }
    const flat = flattenConsent(config, { values, firma, firmaResp, accepted });
    submitConsent(config, flat);
  };

  const handleNew = () => doResetForm();

  // Genera el mismo PDF que se adjunta al correo y lo abre en una pestaña,
  // sin enviar nada. Útil para revisar el formato con lo diligenciado hasta ahora.
  const handlePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const flat = flattenConsent(config, { values, firma, firmaResp, accepted });
      const html = buildVaccinationConsentHtml(config, flat);
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
          <img src={config.meta.logo} alt={config.meta.displayName} className="h-9 w-auto" />
          <div className="mr-auto">
            <h1 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
              Consentimiento de Vacunación
            </h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              {config.meta.entidadNombre} · {config.meta.codigo} v{config.meta.version}
            </p>
          </div>
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
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-5 py-6">
        <GeneralDataSection config={config} values={values} setValue={setValue} />
        <SectionA config={config} values={values} setValue={setValue} />
        <SectionB config={config} values={values} setValue={setValue} />
        <LiveVaccinesSection config={config} values={values} setValue={setValue} />
        <SectionC config={config} onTableChange={(json) => setValue("seccionC", json)} resetKey={resetKey} />
        <LegalSection
          config={config}
          accepted={accepted}
          setAccepted={setAccepted}
          onFirma={setFirma}
          onFirmaResp={setFirmaResp}
          resetKey={resetKey}
        />

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
            {submitting ? "Procesando…" : "Firmar y enviar consentimiento"}
          </button>
        </div>
      </form>

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
          onNewRegistration={handleNew}
          onClose={onBack}
        />
      )}
    </div>
  );
}
