// Componente config-driven: recorre `definition.sections` y pinta cada
// sección con su primitiva correspondiente, leyendo/escribiendo contra
// `ConsentState` vía `onChange` (merge de patch, al estilo setState parcial).

import { cardCls, labelCls, sectionTitleCls, FieldGrid } from "../sections/sharedUi";
import TriStateQuestion from "../fields/TriStateQuestion";
import CheckboxGroupField from "../fields/CheckboxGroupField";
import VaccineTable from "../fields/VaccineTable";
import LegalBlock from "../fields/LegalBlock";
import PhotoField from "../fields/PhotoField";
import SignaturePad from "../SignaturePad";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

type Props = {
  definition: ConsentDefinition;
  state: ConsentState;
  onChange: (patch: Partial<ConsentState>) => void;
};

export default function ConsentRenderer({ definition, state, onChange }: Props) {
  const setValue = (id: string, v: string) => {
    onChange({ values: { ...state.values, [id]: v } });
  };

  return (
    <>
      {definition.sections.map((section) => {
        switch (section.kind) {
          case "fields":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <FieldGrid fields={section.fields} values={state.values} setValue={setValue} />
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

          case "vaccineTable":
            return (
              <section key={section.id} className={cardCls}>
                {section.title && <h2 className={sectionTitleCls}>{section.title}</h2>}
                <VaccineTable columns={section.columns} onChange={(json) => setValue(section.id, json)} />
              </section>
            );

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
                    <SignaturePad onChange={(v) => onChange({ firma: v })} />
                  </div>
                  {section.firmaResponsable && (
                    <div>
                      <label className={labelCls}>
                        {section.firmaResponsable.label}
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <SignaturePad onChange={(v) => onChange({ firmaResp: v })} />
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
