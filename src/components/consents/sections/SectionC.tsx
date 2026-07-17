import type { EntityConfig } from "../config/entityConfig";
import VaccineTable from "../fields/VaccineTable";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  onTableChange: (json: string) => void;
  resetKey: number;
};

export default function SectionC({ config, onTableChange, resetKey }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección C · Datos de la(s) vacuna(s)</h2>
      <VaccineTable key={resetKey} columns={config.seccionC.columns} onChange={onTableChange} />
    </section>
  );
}
