import type { EntityConfig } from "../config/entityConfig";
import TriStateQuestion from "../fields/TriStateQuestion";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function SectionB({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección B · Cuestionario sobre salud</h2>
      {config.seccionB.map((q) => (
        <TriStateQuestion
          key={q.id}
          q={q}
          value={values[q.id] ?? ""}
          note={q.note ? values[q.note.id] ?? "" : ""}
          onChange={(v) => setValue(q.id, v)}
          onNoteChange={(v) => q.note && setValue(q.note.id, v)}
        />
      ))}
    </section>
  );
}
