import type { EntityConfig } from "../config/entityConfig";
import { FieldGrid, cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function GeneralDataSection({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Datos generales</h2>
      <FieldGrid fields={config.datosGenerales} values={values} setValue={setValue} />
    </section>
  );
}
