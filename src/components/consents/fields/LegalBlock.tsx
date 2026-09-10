import { cardCls, sectionTitleCls } from "../sections/sharedUi";

type Props = {
  legalText: string;
  habeasData: string;
};

export default function LegalBlock({ legalText, habeasData }: Props) {
  const paragraphs = legalText.split("\n\n");

  return (
    <div className={cardCls}>
      {paragraphs.map((p, i) => (
        <p key={i} className="m-0 mb-3 text-[13px] leading-relaxed text-slate-700 last:mb-0 dark:text-slate-200">
          {p}
        </p>
      ))}
      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
        <h4 className={sectionTitleCls}>Tratamiento de Datos Personales (Habeas Data)</h4>
        <p className="m-0 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{habeasData}</p>
      </div>
    </div>
  );
}
