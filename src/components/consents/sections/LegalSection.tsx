import type { EntityConfig } from "../config/entityConfig";
import SignaturePad from "../SignaturePad";
import { cardCls, labelCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  onFirma: (dataUrl: string) => void;
  onFirmaResp: (dataUrl: string) => void;
  resetKey: number;
};

const textBoxCls =
  "mb-4 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

export default function LegalSection({ config, accepted, setAccepted, onFirma, onFirmaResp, resetKey }: Props) {
  return (
    <section className={cardCls}>
      {config.efectosAdversos && (
        <>
          <h2 className={sectionTitleCls}>Posibles efectos adversos esperados</h2>
          <ul className="mb-5 list-disc space-y-1.5 pl-5 text-[13px] text-slate-700 dark:text-slate-200">
            {config.efectosAdversos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}

      <h2 className={sectionTitleCls}>Consentimiento informado</h2>
      <div className={textBoxCls}>
        {config.legalText.split("\n\n").map((p, i) => (
          <p key={i} className="mb-2.5 text-justify last:mb-0">{p}</p>
        ))}
      </div>

      <h2 className={sectionTitleCls}>Habeas Data</h2>
      <div className={textBoxCls}>
        {config.habeasData.split("\n\n").map((p, i) => (
          <p key={i} className="mb-2.5 text-justify last:mb-0">{p}</p>
        ))}
      </div>

      <label className="mb-5 flex cursor-pointer items-start gap-2.5 text-[13px] text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#00c2a8]"
        />
        <span>
          He leído y acepto el consentimiento informado y la autorización de tratamiento de datos.
          <span className="ml-0.5 text-red-500">*</span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            {config.firmas.firmaPaciente.label}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <SignaturePad onChange={onFirma} resetKey={resetKey} />
        </div>
        <div>
          <label className={labelCls}>
            {config.firmas.firmaResponsable.label}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <SignaturePad onChange={onFirmaResp} resetKey={resetKey} />
        </div>
      </div>
    </section>
  );
}
