// Componente config-driven: recorre `definition.sections` y pinta cada
// sección con su primitiva correspondiente, leyendo/escribiendo contra
// `ConsentState` vía `onChange` (merge de patch, al estilo setState parcial).

import { useState } from "react";
import { cardCls, labelCls, sectionTitleCls, FieldGrid } from "../sections/sharedUi";
import TriStateQuestion from "../fields/TriStateQuestion";
import CheckboxGroupField from "../fields/CheckboxGroupField";
import VaccineTable from "../fields/VaccineTable";
import LegalBlock from "../fields/LegalBlock";
import PhotoField from "../fields/PhotoField";
import SignaturePad from "../SignaturePad";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";
import { CIUDADES_COLOMBIA, OTRA_CIUDAD_LABEL } from "../cities/colombiaCities";
import type { ConsentField } from "../config/entityConfig";
import { usePatientLookup } from "../patient/usePatientLookup";
import PatientPrefillNotice from "../patient/PatientPrefillNotice";
import PatientHistoryPanel from "../patient/PatientHistoryPanel";
import PatientLookupWarning from "../patient/PatientLookupWarning";

type Props = {
  definition: ConsentDefinition;
  state: ConsentState;
  onChange: (patch: Partial<ConsentState>) => void;
  /** Autorrelleno por documento. Desactivar al editar un consentimiento guardado (el historial se sigue mostrando, solo lectura). */
  prefill?: boolean;
  /** Id del consentimiento en edición: se excluye del historial del paciente (no es una vacuna "previa"). */
  excludeId?: string;
};

export default function ConsentRenderer({ definition, state, onChange, prefill = true, excludeId }: Props) {
  // "Otra ciudad": el campo pasa a texto libre (la lista de municipios es parcial a propósito).
  const [ciudadLibre, setCiudadLibre] = useState(false);

  const setValue = (id: string, v: string) => {
    if (id === "ciudad" && v === OTRA_CIUDAD_LABEL) {
      setCiudadLibre(true);
      onChange({ values: { ...state.values, ciudad: "" } });
      return;
    }
    onChange({ values: { ...state.values, [id]: v } });
  };

  const { aviso, historial, historialDoc, consultaFallida, deshacer } = usePatientLookup(
    definition, state, onChange, prefill, excludeId,
  );

  return (
    <>
      {aviso && <PatientPrefillNotice aviso={aviso} onUndo={deshacer} />}
      {consultaFallida && <PatientLookupWarning />}
      {definition.sections.map((section) => {
        switch (section.kind) {
          case "fields":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <FieldGrid fields={section.fields.map((f) => withCiudadOptions(f, state.values.ciudad, ciudadLibre))} values={state.values} setValue={setValue} />
                {ciudadLibre && section.fields.some((f) => f.id === "ciudad") && (
                  <button
                    type="button"
                    onClick={() => setCiudadLibre(false)}
                    className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-[#0f766e] underline dark:text-[#2dd4bf]"
                  >
                    Elegir de la lista
                  </button>
                )}
              </section>
            );

          case "tristate":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                {section.questions.map((q) => (
                  <TriStateQuestion
                    key={q.id}
                    q={q}
                    value={state.values[q.id] ?? ""}
                    note={q.note ? state.values[q.note.id] ?? "" : ""}
                    onChange={(v) => setValue(q.id, v)}
                    onNoteChange={(v) => q.note && setValue(q.note.id, v)}
                  />
                ))}
              </section>
            );

          case "conditions":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <CheckboxGroupField
                  group={section.group}
                  value={state.values[section.group.id] ?? ""}
                  onChange={(v) => setValue(section.group.id, v)}
                />
              </section>
            );

          case "vaccineTable": {
            // Modo edición: `state.values[section.id]` ya trae el JSON de filas
            // guardado (mismo formato que emite `onChange`); se usa solo como
            // valor inicial (ver `VaccineTable`, no controlado después de montar).
            let initialRows: Record<string, string>[] | undefined;
            const raw = state.values[section.id];
            if (raw) {
              try {
                initialRows = JSON.parse(raw);
              } catch {
                initialRows = undefined;
              }
            }
            return (
              <div key={section.id}>
                <PatientHistoryPanel historial={historial} />
                <section className={cardCls}>
                  {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                  <VaccineTable
                    columns={section.columns}
                    onChange={(json) => setValue(section.id, json)}
                    initialRows={initialRows}
                    historial={historial}
                    historialDoc={historialDoc}
                    fechaConsentimiento={state.values.fecha}
                  />
                </section>
              </div>
            );
          }

          case "legal":
            // LegalBlock ya envuelve su propio texto en `cardCls`; la casilla
            // de aceptación va en su propia tarjeta para no anidar cardCls dos veces.
            return (
              <section key={section.id}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <LegalBlock legalText={section.legalText} habeasData={section.habeasData} />
                <div className={cardCls}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={state.accepted}
                      onChange={(e) => onChange({ accepted: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#00c2a8]"
                    />
                    <span>
                      He leído y acepto el consentimiento informado y la autorización de tratamiento de datos.
                      <span className="ml-0.5 text-red-500">*</span>
                    </span>
                  </label>
                </div>
              </section>
            );

          case "signatures":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      {section.firmaPaciente.label}
                      <span className="ml-0.5 text-red-500">*</span>
                    </label>
                    <SignaturePad onChange={(v) => onChange({ firma: v })} initialDataUrl={state.firma || undefined} />
                  </div>
                  {section.firmaResponsable && (
                    <div>
                      <label className={labelCls}>
                        {section.firmaResponsable.label}
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <SignaturePad
                        onChange={(v) => onChange({ firmaResp: v })}
                        initialDataUrl={state.firmaResp || undefined}
                      />
                    </div>
                  )}
                </div>
              </section>
            );

          case "photo":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <PhotoField
                  label={section.photo.label}
                  value={state.foto}
                  onChange={(v) => onChange({ foto: v })}
                />
              </section>
            );

          default:
            return null;
        }
      })}
    </>
  );
}

// "ciudad" se muestra como desplegable "Municipio, Departamento" con una salida final "Otra ciudad" que
// pasa a texto libre (la lista es parcial: sin salida, un municipio no listado impediría firmar). Si el valor
// guardado no está en la lista (consentimientos antiguos o escrito a mano) se añade para no perderlo.
function withCiudadOptions(f: ConsentField, current: string | undefined, libre: boolean): ConsentField {
  if (f.id !== "ciudad") return f;
  if (libre) return { ...f, type: "text", placeholder: "Municipio, Departamento" };
  const base = current && !CIUDADES_COLOMBIA.includes(current) ? [current, ...CIUDADES_COLOMBIA] : CIUDADES_COLOMBIA;
  return { ...f, type: "select", options: [...base, OTRA_CIUDAD_LABEL] };
}
