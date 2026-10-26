import type { SubformField } from "../subform.types";
import Icon from "../../../common/Icon";
import SubformFieldTypeSelect from "./SubformFieldTypeSelect";
import {
  FIELDS_WITH_OPTIONS,
  FIELD_TYPES,
  SUBFORM_FIELD_ICONS,
  SUBFORM_INPUT_CLASS,
  SUBFORM_LABEL_CLASS,
} from "./constants";

type FieldEditorProps = {
  field: SubformField | null;
  onUpdate: (id: string, changes: Partial<SubformField>) => void;
};

function PreviewPlaceholder({
  iconName,
  text,
}: {
  iconName: string;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-slate-300 bg-slate-50 py-5 text-xs text-slate-500">
      <Icon name={iconName} size={16} /> {text}
    </div>
  );
}

function FieldPreview({ field }: { field: SubformField }) {
  const requiredMark = field.required && (
    <span className="ml-0.5 text-red-500">*</span>
  );

  return (
    <div className="rounded-[10px] border-[1.5px] border-slate-200 bg-white px-4 py-3.5">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
        Vista previa
      </div>
      <div className="mb-1.5 text-[13px] font-semibold text-slate-700">
        {field.label}
        {requiredMark}
      </div>
      {field.type === "textarea" && (
        <textarea
          disabled
          rows={2}
          placeholder={field.placeholder || ""}
          className={`${SUBFORM_INPUT_CLASS} resize-none opacity-60`}
        />
      )}
      {field.type === "select" && (
        <select disabled className={`${SUBFORM_INPUT_CLASS} opacity-60`}>
          <option>-- Selecciona --</option>
          {(field.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      {(field.type === "radio" || field.type === "checkbox") && (
        <div className="flex flex-col gap-1.5">
          {(field.options || []).map((o) => (
            <label
              key={o}
              className="flex items-center gap-1.5 text-[13px] text-slate-500"
            >
              <input
                type={field.type === "radio" ? "radio" : "checkbox"}
                disabled
              />{" "}
              {o}
            </label>
          ))}
        </div>
      )}
      {field.type === "header" && (
        <h3 className="m-0 text-base font-bold text-slate-900">{field.label}</h3>
      )}
      {field.type === "htmlblock" && (
        <div
          className="rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600"
          dangerouslySetInnerHTML={{ __html: field.htmlContent || "<em>HTML vacío</em>" }}
        />
      )}
      {field.type === "image" && field.url && (
        <img
          src={field.url}
          alt={field.label}
          className="max-h-[120px] rounded border border-slate-200 object-contain"
        />
      )}
      {field.type === "video" && field.url && (
        <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Icon name="video" size={14} />
          <span className="font-mono">{field.url}</span>
        </div>
      )}
      {field.type === "signature" && (
        <PreviewPlaceholder iconName="edit" text="Zona de firma" />
      )}
      {field.type === "photo" && (
        <PreviewPlaceholder iconName="camera" text="Captura de foto" />
      )}
      {field.type === "file" && (
        <PreviewPlaceholder iconName="file" text="Adjuntar archivo" />
      )}
      {field.type === "calc" && (
        <div className="flex items-center justify-center gap-2 rounded-md border-[1.5px] border-cyan-400 bg-cyan-50/60 px-3 py-2 font-mono text-sm font-bold text-cyan-700">
          <Icon name="calc" size={14} />
          {field.formula ? `= ${field.formula}` : "0.00"}
        </div>
      )}
      {field.type === "quiz_score" && (
        <div className="flex items-center justify-center gap-2 rounded-md border-[1.5px] border-amber-400 bg-amber-50 px-3 py-2 font-mono text-sm font-bold text-amber-700">
          <Icon name="award" size={14} /> Nota: 0
        </div>
      )}
      {field.type === "price" && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
            {field.pricePrefix || "$"}
          </span>
          <input
            disabled
            type="number"
            placeholder={field.placeholder || ""}
            className={`${SUBFORM_INPUT_CLASS} pl-10 opacity-60`}
          />
        </div>
      )}
      {field.type === "time" && (
        <input disabled type="time" className={`${SUBFORM_INPUT_CLASS} opacity-60`} />
      )}
      {["text", "number", "email", "phone", "date", "barcode", "idscanner", "idDocument", "search"].includes(field.type) && (
        <input
          disabled
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
              ? "number"
              : "text"
          }
          placeholder={field.placeholder || ""}
          className={`${SUBFORM_INPUT_CLASS} opacity-60`}
        />
      )}
      {field.type === "quiz_question" && (
        <div className="flex flex-col gap-1 text-[12.5px] text-slate-500">
          {(field.options || []).map((o, i) => {
            const isCorrect = i === (field.correctOptionIndex ?? 0);
            return (
              <label key={o} className="flex items-center gap-1.5">
                <input type="radio" disabled />
                <span
                  className={
                    isCorrect
                      ? "inline-flex items-center gap-1 font-semibold text-emerald-700"
                      : ""
                  }
                >
                  {o}
                  {isCorrect && <Icon name="check" size={12} />}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FieldEditor({ field, onUpdate }: FieldEditorProps) {
  if (!field) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="edit" size={28} />
        </span>
        <p className="m-0 text-[15px] font-semibold text-slate-700">
          Selecciona un campo para editarlo
        </p>
        <p className="mt-1.5 text-[13px]">
          O haz clic en "+ Agregar" para crear uno nuevo
        </p>
      </div>
    );
  }

  const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
  const iconName = SUBFORM_FIELD_ICONS[field.type] ?? "grid";
  const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);
  // Placeholder NO aplica a tipos sin input editable o con config propia.
  const noPlaceholder = new Set([
    "checkbox",
    "select",
    "radio",
    "search",
    "header",
    "htmlblock",
    "image",
    "video",
    "signature",
    "photo",
    "file",
    "calc",
    "quiz_question",
    "quiz_score",
  ]);
  const hasPlaceholder = !noPlaceholder.has(field.type);
  // Tipos que no se pueden marcar como obligatorios (decorativos / calculados).
  const noRequired = new Set([
    "header",
    "htmlblock",
    "image",
    "video",
    "calc",
    "quiz_score",
  ]);
  const supportsRequired = !noRequired.has(field.type);

  return (
    <div className="max-w-[520px]">
      <div className="mb-6 flex items-center gap-3 border-b-2 border-slate-200 pb-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-white shadow-[0_6px_16px_-6px_rgba(0,194,168,0.6)]">
          <Icon name={iconName} size={20} />
        </span>
        <div>
          <div className="text-base font-extrabold text-slate-900">
            {field.label}
          </div>
          <div className="text-xs text-slate-500">{typeInfo?.label}</div>
        </div>
      </div>

      <div className="mb-[18px]">
        <label className={SUBFORM_LABEL_CLASS}>Etiqueta</label>
        <input
          className={SUBFORM_INPUT_CLASS}
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
        />
      </div>

      <div className="mb-[18px]">
        <label className={SUBFORM_LABEL_CLASS}>Tipo</label>
        <SubformFieldTypeSelect
          value={field.type}
          onChange={(v) => onUpdate(field.id, { type: v })}
        />
      </div>

      {hasPlaceholder && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Placeholder</label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.placeholder || ""}
            placeholder="Ej: Escribe aquí..."
            onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
          />
        </div>
      )}

      {hasOptions && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>
            Opciones{" "}
            <span className="font-normal normal-case text-slate-400">
              (una por línea)
            </span>
          </label>
          <textarea
            className={`${SUBFORM_INPUT_CLASS} min-h-[100px] resize-y font-sans leading-relaxed`}
            value={(field.options || []).join("\n")}
            placeholder={"Opción 1\nOpción 2"}
            onChange={(e) =>
              onUpdate(field.id, {
                options: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </div>
      )}

      {/* ── Configs específicas por tipo ── */}

      {field.type === "price" && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Prefijo</label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.pricePrefix || "$"}
            placeholder="$"
            onChange={(e) => onUpdate(field.id, { pricePrefix: e.target.value })}
          />
        </div>
      )}

      {(field.type === "image" || field.type === "video") && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>URL</label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.url || ""}
            placeholder={field.type === "image" ? "https://…/imagen.png" : "https://youtube.com/watch?v=…"}
            onChange={(e) => onUpdate(field.id, { url: e.target.value })}
          />
        </div>
      )}

      {field.type === "htmlblock" && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Contenido HTML</label>
          <textarea
            className={`${SUBFORM_INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
            value={field.htmlContent || ""}
            placeholder="<p>Lorem ipsum…</p>"
            onChange={(e) => onUpdate(field.id, { htmlContent: e.target.value })}
          />
        </div>
      )}

      {field.type === "file" && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>
            Tipos aceptados{" "}
            <span className="font-normal normal-case text-slate-400">(opcional)</span>
          </label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.accept || ""}
            placeholder="application/pdf,image/*"
            onChange={(e) => onUpdate(field.id, { accept: e.target.value })}
          />
        </div>
      )}

      {field.type === "calc" && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>
            Fórmula{" "}
            <span className="font-normal normal-case text-slate-400">
              (usa ids de los otros campos — vacío = suma de todos los números)
            </span>
          </label>
          <input
            className={`${SUBFORM_INPUT_CLASS} font-mono`}
            value={field.formula || ""}
            placeholder="precio*cantidad"
            onChange={(e) => onUpdate(field.id, { formula: e.target.value })}
          />
          <div className="mt-1 text-[11px] text-slate-400">
            Operadores permitidos: + - * / ( )
          </div>
        </div>
      )}

      {field.type === "quiz_question" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>
              Índice de la opción correcta{" "}
              <span className="font-normal normal-case text-slate-400">
                (0 = la primera)
              </span>
            </label>
            <input
              type="number"
              min={0}
              className={SUBFORM_INPUT_CLASS}
              value={field.correctOptionIndex ?? 0}
              onChange={(e) =>
                onUpdate(field.id, {
                  correctOptionIndex: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Puntos de la correcta</label>
            <input
              type="number"
              min={0}
              className={SUBFORM_INPUT_CLASS}
              value={field.points ?? 1}
              onChange={(e) =>
                onUpdate(field.id, { points: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </>
      )}

      {supportsRequired && (
        <label
          className="mb-[18px] flex cursor-pointer items-center gap-2.5 rounded-[10px] border-[1.5px] px-3.5 py-3 transition-colors"
          style={{
            background: field.required ? "#e6faf7" : "#f8fafc",
            borderColor: field.required ? "#00c2a8" : "#e2e8f0",
          }}
        >
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
            className="h-4 w-4 accent-[#00c2a8]"
          />
          <div>
            <div
              className="text-[13px] font-semibold"
              style={{ color: field.required ? "#0891b2" : "#111827" }}
            >
              Campo obligatorio
            </div>
            <div
              className="text-[11px]"
              style={{ color: field.required ? "#0e9b94" : "#64748b" }}
            >
              El usuario debe completar este campo
            </div>
          </div>
        </label>
      )}

      <FieldPreview field={field} />
    </div>
  );
}
