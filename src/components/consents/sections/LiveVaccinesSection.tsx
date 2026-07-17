import type { EntityConfig } from "../config/entityConfig";
import TriStateQuestion from "../fields/TriStateQuestion";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function LiveVaccinesSection({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Vacunas de virus vivos · Preguntas adicionales</h2>
      <p className="m-0 mb-3 text-[12px] italic text-slate-500 dark:text-slate-400">
        (Varicela, MMR® II, tifoidea oral, herpes, fiebre amarilla, cólera)
      </p>
      {config.virusVivos.map((q) => (
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
