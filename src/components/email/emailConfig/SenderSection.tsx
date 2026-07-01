const INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px]";

type SenderSectionProps = {
  senderName: string;
  replyTo: string;
  onChangeSenderName: (v: string) => void;
  onChangeReplyTo: (v: string) => void;
};

export default function SenderSection({
  senderName,
  replyTo,
  onChangeSenderName,
  onChangeReplyTo,
}: SenderSectionProps) {
  return (
    <div className="mb-5 rounded-xl border-2 border-slate-200 bg-slate-50 p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-lg">✍️</span>
        <h3 className="m-0 text-[15px] font-bold text-gray-900">Remitente</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
            Nombre del remitente
          </label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => onChangeSenderName(e.target.value)}
            placeholder="Ej: Grupo Soul - SoulForms"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
            Responder a (opcional)
          </label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => onChangeReplyTo(e.target.value)}
            placeholder="Ej: soporte@gruposoul.com"
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
