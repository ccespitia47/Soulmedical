import type { EntityConfig } from "../config/entityConfig";
import CheckboxGroupField from "../fields/CheckboxGroupField";
import TriStateQuestion from "../fields/TriStateQuestion";
import { FieldControl, cardCls, labelCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function SectionA({ config, values, setValue }: Props) {
  const a = config.seccionA;
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección A · Historial de vacunas</h2>

      {a.tetanosAnios && (
        <div className="mb-4">
          <label className={labelCls}>{a.tetanosAnios.label}</label>
          <FieldControl field={a.tetanosAnios} value={values[a.tetanosAnios.id] ?? ""} onChange={(v) => setValue(a.tetanosAnios!.id, v)} />
        </div>
      )}

      <div className="mb-4">
        <CheckboxGroupField group={a.condiciones} value={values[a.condiciones.id] ?? ""} onChange={(v) => setValue(a.condiciones.id, v)} />
      </div>

      <TriStateQuestion
        q={a.antineumococica}
        value={values[a.antineumococica.id] ?? ""}
        note=""
        onChange={(v) => setValue(a.antineumococica.id, v)}
        onNoteChange={() => {}}
      />
      <div className="my-3">
        <label className={labelCls}>{a.antineumococicaFecha.label}</label>
        <FieldControl field={a.antineumococicaFecha} value={values[a.antineumococicaFecha.id] ?? ""} onChange={(v) => setValue(a.antineumococicaFecha.id, v)} />
      </div>

      <TriStateQuestion
        q={a.herpesZoster}
        value={values[a.herpesZoster.id] ?? ""}
        note=""
        onChange={(v) => setValue(a.herpesZoster.id, v)}
        onNoteChange={() => {}}
      />
    </section>
  );
}
