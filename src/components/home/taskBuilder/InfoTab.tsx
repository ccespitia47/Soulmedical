import { TASK_INPUT_CLASS, TASK_LABEL_CLASS } from "./types";

type InfoTabProps = {
  title: string;
  description: string;
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
};

export default function InfoTab({
  title,
  description,
  onChangeTitle,
  onChangeDescription,
}: InfoTabProps) {
  return (
    <>
      <div className="mb-4">
        <label className={TASK_LABEL_CLASS}>Título de la tarea *</label>
        <input
          className={TASK_INPUT_CLASS}
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Ej: Consentimiento para paciente"
        />
      </div>
      <div>
        <label className={TASK_LABEL_CLASS}>Descripción (opcional)</label>
        <textarea
          className={`${TASK_INPUT_CLASS} min-h-[80px] resize-y`}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          placeholder="Instrucciones para los destinatarios..."
        />
      </div>
    </>
  );
}
