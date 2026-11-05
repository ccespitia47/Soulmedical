import { useEffect, useRef, useState } from "react";
import type { SubformField } from "../subform.types";
import Icon from "../../../common/Icon";
import SubformFieldTypeSelect from "./SubformFieldTypeSelect";
import { deleteFormAsset, uploadFormAsset } from "../../../../services/formAssets";
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
        <div
          style={{
            display:
              field.type === "radio" && field.verticalAlign === false
                ? "grid"
                : "flex",
            flexDirection:
              field.type === "radio" && field.verticalAlign === false
                ? undefined
                : "column",
            gridTemplateColumns:
              field.type === "radio" && field.verticalAlign === false
                ? "repeat(auto-fit, minmax(120px, 1fr))"
                : undefined,
            gap: 6,
          }}
        >
          {(field.options || []).map((o) => (
            <label
              key={o}
              className="flex items-center gap-1.5 text-[13px] text-slate-500"
              style={{
                whiteSpace:
                  field.type === "radio" && field.verticalAlign === false
                    ? "nowrap"
                    : "normal",
              }}
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
      {field.type === "video" && (
        <PreviewPlaceholder iconName="video" text="Captura de video" />
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
          <OptionsTextarea
            key={field.id}
            options={field.options || []}
            onChange={(opts) => onUpdate(field.id, { options: opts })}
          />
        </div>
      )}

      {/* ── Configs específicas por tipo ── */}

      {field.type === "price" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Prefijo (símbolo visible)</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.pricePrefix || "$"}
              placeholder="$"
              onChange={(e) => onUpdate(field.id, { pricePrefix: e.target.value })}
            />
          </div>
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Moneda</label>
              <input
                className={SUBFORM_INPUT_CLASS}
                value={field.currency || "COP"}
                placeholder="COP"
                onChange={(e) =>
                  onUpdate(field.id, { currency: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Separador decimal</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.decimalMark || "comma"}
                onChange={(e) =>
                  onUpdate(field.id, {
                    decimalMark: e.target.value as "comma" | "dot",
                  })
                }
              >
                <option value="comma">Coma (1.234,56)</option>
                <option value="dot">Punto (1,234.56)</option>
              </select>
            </div>
          </div>
          <div className="mb-[18px] grid grid-cols-3 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Decimales</label>
              <input
                type="number"
                min={0}
                max={6}
                className={SUBFORM_INPUT_CLASS}
                value={field.decimalPrecision ?? 2}
                onChange={(e) =>
                  onUpdate(field.id, {
                    decimalPrecision: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Mín</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.minAmount ?? ""}
                onChange={(e) =>
                  onUpdate(field.id, {
                    minAmount:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Máx</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.maxAmount ?? ""}
                onChange={(e) =>
                  onUpdate(field.id, {
                    maxAmount:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.rememberInput ?? false}
              onChange={(e) =>
                onUpdate(field.id, { rememberInput: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Recordar última entrada en el dispositivo</span>
          </label>
        </>
      )}

      {field.type === "image" && (
        <ImageSource field={field} onUpdate={onUpdate} />
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

      {field.type === "calc" && (
        <>
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Operador</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.calcOperator || "sum"}
                onChange={(e) =>
                  onUpdate(field.id, {
                    calcOperator: e.target
                      .value as SubformField["calcOperator"],
                  })
                }
              >
                <option value="sum">Sumar</option>
                <option value="subtract">Restar</option>
                <option value="multiply">Multiplicar</option>
                <option value="divide">Dividir</option>
                <option value="average">Promedio</option>
                <option value="min">Mínimo</option>
                <option value="max">Máximo</option>
                <option value="count">Contar</option>
              </select>
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Decimales</label>
              <input
                type="number"
                min={0}
                max={6}
                className={SUBFORM_INPUT_CLASS}
                value={field.decimalPrecision ?? 2}
                onChange={(e) =>
                  onUpdate(field.id, {
                    decimalPrecision: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>
              Fórmula{" "}
              <span className="font-normal normal-case text-slate-400">
                (opcional — si se llena, sobrescribe el operador)
              </span>
            </label>
            <input
              className={`${SUBFORM_INPUT_CLASS} font-mono`}
              value={field.formula || ""}
              placeholder="precio*cantidad"
              onChange={(e) => onUpdate(field.id, { formula: e.target.value })}
            />
            <div className="mt-1 text-[11px] text-slate-400">
              Operadores permitidos: + - * / ( ). Vacío = aplica el operador
              de arriba a todos los campos number del subform.
            </div>
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Valor inicial</label>
            <input
              type="number"
              className={SUBFORM_INPUT_CLASS}
              value={field.initialValue ?? ""}
              placeholder="0"
              onChange={(e) =>
                onUpdate(field.id, {
                  initialValue:
                    e.target.value === "" ? undefined : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.ignoreInvalid ?? true}
              onChange={(e) =>
                onUpdate(field.id, { ignoreInvalid: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Ignorar valores no numéricos</span>
          </label>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.isPrice ?? false}
              onChange={(e) =>
                onUpdate(field.id, { isPrice: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Mostrar como precio (usa el prefijo pricePrefix)</span>
          </label>
          {field.isPrice && (
            <div className="mb-[18px] grid grid-cols-2 gap-3">
              <div>
                <label className={SUBFORM_LABEL_CLASS}>Prefijo</label>
                <input
                  className={SUBFORM_INPUT_CLASS}
                  value={field.pricePrefix || "$"}
                  onChange={(e) =>
                    onUpdate(field.id, { pricePrefix: e.target.value })
                  }
                />
              </div>
              <div>
                <label className={SUBFORM_LABEL_CLASS}>Moneda</label>
                <input
                  className={SUBFORM_INPUT_CLASS}
                  value={field.currency || "COP"}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      currency: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
          )}
        </>
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

      {/* ── Textarea: rows + maxLength + defaultValue ── */}
      {field.type === "textarea" && (
        <div className="mb-[18px] grid grid-cols-3 gap-3">
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.defaultValue || ""}
              onChange={(e) => onUpdate(field.id, { defaultValue: e.target.value })}
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Filas</label>
            <input
              type="number"
              min={1}
              max={20}
              className={SUBFORM_INPUT_CLASS}
              value={field.rows ?? 3}
              onChange={(e) =>
                onUpdate(field.id, { rows: parseInt(e.target.value) || 3 })
              }
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Long. máxima</label>
            <input
              type="number"
              min={0}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxLength ?? ""}
              placeholder="Sin límite"
              onChange={(e) =>
                onUpdate(field.id, {
                  maxLength:
                    e.target.value === "" ? undefined : parseInt(e.target.value),
                })
              }
            />
          </div>
        </div>
      )}

      {/* ── Number: min/max/step + defaultValue + allowDecimals ── */}
      {field.type === "number" && (
        <>
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.defaultValue ?? ""}
                onChange={(e) =>
                  onUpdate(field.id, { defaultValue: e.target.value })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Paso (step)</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.step ?? ""}
                placeholder="1"
                onChange={(e) =>
                  onUpdate(field.id, {
                    step:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Mínimo</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.min ?? ""}
                onChange={(e) =>
                  onUpdate(field.id, {
                    min:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Máximo</label>
              <input
                type="number"
                className={SUBFORM_INPUT_CLASS}
                value={field.max ?? ""}
                onChange={(e) =>
                  onUpdate(field.id, {
                    max:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowDecimals ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowDecimals: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir decimales</span>
          </label>
        </>
      )}

      {/* ── Phone: prefijo + maxLength + defaultValue ── */}
      {field.type === "phone" && (
        <div className="mb-[18px] grid grid-cols-3 gap-3">
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Prefijo</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.prefix || ""}
              placeholder="+57"
              onChange={(e) => onUpdate(field.id, { prefix: e.target.value })}
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Long. máxima</label>
            <input
              type="number"
              min={0}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxLength ?? ""}
              placeholder="10"
              onChange={(e) =>
                onUpdate(field.id, {
                  maxLength:
                    e.target.value === "" ? undefined : parseInt(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Valor por defecto</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.defaultValue || ""}
              onChange={(e) =>
                onUpdate(field.id, { defaultValue: e.target.value })
              }
            />
          </div>
        </div>
      )}

      {/* ── Date: min/max + defaultValue ── */}
      {field.type === "date" && (
        <div className="mb-[18px] grid grid-cols-3 gap-3">
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
            <input
              type="date"
              className={SUBFORM_INPUT_CLASS}
              value={field.defaultValue || ""}
              onChange={(e) =>
                onUpdate(field.id, { defaultValue: e.target.value })
              }
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Fecha mínima</label>
            <input
              type="date"
              className={SUBFORM_INPUT_CLASS}
              value={field.minDate || ""}
              onChange={(e) => onUpdate(field.id, { minDate: e.target.value })}
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Fecha máxima</label>
            <input
              type="date"
              className={SUBFORM_INPUT_CLASS}
              value={field.maxDate || ""}
              onChange={(e) => onUpdate(field.id, { maxDate: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ── Time: now by default + rememberInput ── */}
      {field.type === "time" && (
        <>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.nowByDefault ?? false}
              onChange={(e) =>
                onUpdate(field.id, { nowByDefault: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Ahora por defecto</span>
          </label>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.rememberInput ?? false}
              onChange={(e) =>
                onUpdate(field.id, { rememberInput: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Recordar última entrada</span>
          </label>
        </>
      )}

      {/* ── Photo: cámara / disco / tamaño máximo ── */}
      {field.type === "photo" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Tamaño máximo (MB)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxSizeMB ?? ""}
              placeholder="Sin límite"
              onChange={(e) =>
                onUpdate(field.id, {
                  maxSizeMB:
                    e.target.value === "" ? undefined : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowCamera ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowCamera: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir abrir la cámara</span>
          </label>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowUpload ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowUpload: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir subir desde el dispositivo</span>
          </label>
        </>
      )}

      {/* ── File: fileType + maxSizeMB ── */}
      {field.type === "file" && (
        <div className="mb-[18px] grid grid-cols-2 gap-3">
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Tipo permitido</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.fileType || "documents"}
              onChange={(e) =>
                onUpdate(field.id, {
                  fileType: e.target.value as SubformField["fileType"],
                })
              }
            >
              <option value="documents">Documentos (PDF, Word, Excel)</option>
              <option value="images">Imágenes</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="any">Cualquier tipo</option>
            </select>
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Tamaño máx. (MB)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxSizeMB ?? ""}
              placeholder="Sin límite"
              onChange={(e) =>
                onUpdate(field.id, {
                  maxSizeMB:
                    e.target.value === "" ? undefined : parseFloat(e.target.value),
                })
              }
            />
          </div>
        </div>
      )}

      {/* ── idDocument: thousandsSeparator ── */}
      {field.type === "idDocument" && (
        <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
          <input
            type="checkbox"
            checked={field.thousandsSeparator ?? false}
            onChange={(e) =>
              onUpdate(field.id, { thousandsSeparator: e.target.checked })
            }
            className="h-4 w-4 accent-[#00c2a8]"
          />
          <span>Formatear con separador de miles (1.234.567)</span>
        </label>
      )}

      {/* ── Image: maxWidth/maxHeight/clickable ── */}
      {field.type === "image" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Anchura máxima (px)</label>
            <input
              type="number"
              min={20}
              max={1200}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxWidth ?? 180}
              onChange={(e) =>
                onUpdate(field.id, {
                  maxWidth: parseInt(e.target.value) || 180,
                })
              }
            />
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Altura máxima (px)</label>
            <input
              type="number"
              min={20}
              max={1200}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxHeight ?? ""}
              placeholder="Sin límite"
              onChange={(e) => {
                const n = parseInt(e.target.value);
                onUpdate(field.id, {
                  maxHeight: Number.isFinite(n) ? n : undefined,
                });
              }}
            />
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.clickable ?? false}
              onChange={(e) =>
                onUpdate(field.id, { clickable: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Haz clic para ver la imagen ampliada</span>
          </label>
        </>
      )}

      {/* ── Video: maxDurationSecs + maxSizeMB ── */}
      {field.type === "video" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>
              Duración máxima (segundos)
            </label>
            <input
              type="number"
              min={5}
              max={1800}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxDurationSecs ?? 60}
              onChange={(e) =>
                onUpdate(field.id, {
                  maxDurationSecs: parseInt(e.target.value) || 60,
                })
              }
            />
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Tamaño máximo (MB)</label>
            <input
              type="number"
              min={5}
              max={200}
              className={SUBFORM_INPUT_CLASS}
              value={field.maxSizeMB ?? 100}
              onChange={(e) =>
                onUpdate(field.id, {
                  maxSizeMB: parseInt(e.target.value) || 100,
                })
              }
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Cap absoluto del servidor: 200 MB.
            </p>
          </div>
        </>
      )}

      {/* ── Header: text + size + divider ── */}
      {field.type === "header" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Texto del encabezado</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.headerText || ""}
              placeholder="Datos del paciente"
              onChange={(e) =>
                onUpdate(field.id, { headerText: e.target.value })
              }
            />
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Tamaño</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.headerSize || "medium"}
              onChange={(e) =>
                onUpdate(field.id, {
                  headerSize: e.target.value as SubformField["headerSize"],
                })
              }
            >
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.showDivider ?? true}
              onChange={(e) =>
                onUpdate(field.id, { showDivider: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Mostrar línea divisoria debajo</span>
          </label>
        </>
      )}

      {/* ── Barcode: scannerEnabled ── */}
      {field.type === "barcode" && (
        <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
          <input
            type="checkbox"
            checked={field.scannerEnabled ?? false}
            onChange={(e) =>
              onUpdate(field.id, { scannerEnabled: e.target.checked })
            }
            className="h-4 w-4 accent-[#00c2a8]"
          />
          <span>Habilitar botón "Escanear" (preview, sin cámara real aún)</span>
        </label>
      )}

      {/* ── idscanner: documentType, allowManual, fields a extraer ── */}
      {field.type === "idscanner" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Tipo de documento</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.documentType || "auto"}
              onChange={(e) =>
                onUpdate(field.id, {
                  documentType: e.target
                    .value as SubformField["documentType"],
                })
              }
            >
              <option value="auto">Detección automática</option>
              <option value="cc">Cédula de Ciudadanía (CC)</option>
              <option value="ce">Cédula de Extranjería (CE)</option>
              <option value="ti">Tarjeta de Identidad (TI)</option>
              <option value="passport">Pasaporte</option>
            </select>
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Campos a extraer</label>
            <div className="flex flex-col gap-1">
              {[
                { id: "nombre", label: "Nombre completo" },
                { id: "numero", label: "Número de documento" },
                { id: "fechaNacimiento", label: "Fecha de nacimiento" },
                { id: "sexo", label: "Sexo" },
                { id: "fechaExpedicion", label: "Fecha de expedición" },
                { id: "lugarExpedicion", label: "Lugar de expedición" },
              ].map((f) => {
                const checked = (field.idscannerFields || ["numero", "nombre"]).includes(f.id);
                return (
                  <label key={f.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const cur = field.idscannerFields || ["numero", "nombre"];
                        const next = e.target.checked
                          ? [...cur, f.id]
                          : cur.filter((x) => x !== f.id);
                        onUpdate(field.id, { idscannerFields: next });
                      }}
                      className="h-4 w-4 accent-[#00c2a8]"
                    />
                    {f.label}
                  </label>
                );
              })}
            </div>
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowManual ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowManual: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir edición manual del resultado</span>
          </label>
        </>
      )}

      {/* ── Text: valor por defecto + filtros de teclado ── */}
      {field.type === "text" && (
        <>
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
              <input
                className={SUBFORM_INPUT_CLASS}
                value={field.defaultValue || ""}
                onChange={(e) =>
                  onUpdate(field.id, { defaultValue: e.target.value })
                }
              />
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Longitud máxima</label>
              <input
                type="number"
                min={0}
                className={SUBFORM_INPUT_CLASS}
                value={field.maxLength ?? ""}
                placeholder="Sin límite"
                onChange={(e) =>
                  onUpdate(field.id, {
                    maxLength:
                      e.target.value === "" ? undefined : parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowNumbers ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowNumbers: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir dígitos</span>
          </label>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowSpecialChars ?? true}
              onChange={(e) =>
                onUpdate(field.id, { allowSpecialChars: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir caracteres especiales (@ # $ …)</span>
          </label>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.allowLineBreaks ?? false}
              onChange={(e) =>
                onUpdate(field.id, { allowLineBreaks: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir saltos de línea (convierte en área)</span>
          </label>
        </>
      )}

      {/* ── Select (Desplegable): default, multi, expand, sort, remember ── */}
      {field.type === "select" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.defaultValue || ""}
              onChange={(e) =>
                onUpdate(field.id, { defaultValue: e.target.value })
              }
            >
              <option value="">— Sin valor —</option>
              {(field.options || []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.sortAlphabetically ?? false}
              onChange={(e) =>
                onUpdate(field.id, { sortAlphabetically: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Ordenar alfabéticamente</span>
          </label>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.multiple ?? false}
              onChange={(e) =>
                onUpdate(field.id, {
                  multiple: e.target.checked,
                  defaultValue: e.target.checked ? "" : field.defaultValue,
                })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir múltiples selecciones</span>
          </label>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.expand ?? false}
              onChange={(e) => onUpdate(field.id, { expand: e.target.checked })}
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Expandir (mostrar como radios/checkboxes)</span>
          </label>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.rememberInput ?? false}
              onChange={(e) =>
                onUpdate(field.id, { rememberInput: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Recordar última entrada en el dispositivo</span>
          </label>
        </>
      )}

      {/* ── Quiz score: incluir, visibilidad, decimales, mostrar máximo ── */}
      {field.type === "quiz_score" && (
        <>
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Visibilidad</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.visibility || "visible"}
                onChange={(e) =>
                  onUpdate(field.id, {
                    visibility: e.target
                      .value as SubformField["visibility"],
                  })
                }
              >
                <option value="visible">Siempre visible</option>
                <option value="after_submit">Solo después de enviar</option>
                <option value="hidden">Oculto al usuario</option>
              </select>
            </div>
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Decimales</label>
              <input
                type="number"
                min={0}
                max={6}
                className={SUBFORM_INPUT_CLASS}
                value={field.decimalPrecision ?? 1}
                onChange={(e) =>
                  onUpdate(field.id, {
                    decimalPrecision: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.showMax ?? true}
              onChange={(e) =>
                onUpdate(field.id, { showMax: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Mostrar el máximo (ej. "7.5 / 10")</span>
          </label>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Preguntas a sumar</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.includeQuestions || "all"}
              onChange={(e) =>
                onUpdate(field.id, {
                  includeQuestions: e.target
                    .value as SubformField["includeQuestions"],
                })
              }
            >
              <option value="all">Todas las preguntas del subform</option>
              <option value="select">Elegir manualmente</option>
            </select>
          </div>
        </>
      )}

      {/* ── Signature: color y grosor del trazo ── */}
      {field.type === "signature" && (
        <div className="mb-[18px] grid grid-cols-2 gap-3">
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Color del trazo</label>
            <input
              type="color"
              className={`${SUBFORM_INPUT_CLASS} h-10 cursor-pointer p-1`}
              value={field.penColor || "#000000"}
              onChange={(e) => onUpdate(field.id, { penColor: e.target.value })}
            />
          </div>
          <div>
            <label className={SUBFORM_LABEL_CLASS}>Grosor (px)</label>
            <input
              type="number"
              min={1}
              max={10}
              className={SUBFORM_INPUT_CLASS}
              value={field.penWidth ?? 2}
              onChange={(e) =>
                onUpdate(field.id, {
                  penWidth: parseInt(e.target.value) || 2,
                })
              }
            />
          </div>
        </div>
      )}

      {/* ── Radio: valor predeterminado, alineación, recordar entrada ── */}
      {field.type === "radio" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Valor predeterminado</label>
            <select
              className={SUBFORM_INPUT_CLASS}
              value={field.defaultValue || ""}
              onChange={(e) =>
                onUpdate(field.id, { defaultValue: e.target.value })
              }
            >
              <option value="">— Ninguno —</option>
              {(field.options || []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Alineación</label>
            <div
              className="grid grid-cols-2 gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-slate-100 p-1"
            >
              {([
                { v: true, label: "Vertical", icon: "list" },
                { v: false, label: "Horizontal", icon: "grid" },
              ] as const).map((opt) => {
                const active = (field.verticalAlign ?? true) === opt.v;
                return (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() =>
                      onUpdate(field.id, { verticalAlign: opt.v })
                    }
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-none px-2.5 py-1.5 text-[12.5px] font-semibold transition-all"
                    style={{
                      background: active ? "white" : "transparent",
                      color: active ? "#0891b2" : "#64748b",
                      boxShadow: active
                        ? "0 1px 3px rgba(0,0,0,0.08)"
                        : "none",
                    }}
                  >
                    <Icon name={opt.icon} size={13} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.rememberInput ?? false}
              onChange={(e) =>
                onUpdate(field.id, { rememberInput: e.target.checked })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Recordar última entrada en el dispositivo</span>
          </label>
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

/**
 * Textarea para editar opciones (una por línea).
 *
 * Problema que resuelve: si guardamos directamente `split("\n").filter(Boolean)`
 * en el estado padre, cada vez que el usuario presiona Enter se crea una
 * línea vacía que el filter elimina al instante, y el textarea controlado
 * se re-renderiza perdiendo el salto de línea → "Enter no hace nada".
 *
 * Fix: buffer local con el texto crudo (incluye líneas vacías mientras se
 * edita), y propagamos al padre el array filtrado. El `key={field.id}` del
 * caller sincroniza el buffer al cambiar de campo.
 */
function ImageSource({
  field,
  onUpdate,
}: {
  field: SubformField;
  onUpdate: (id: string, changes: Partial<SubformField>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasUpload = !!field.imageFileId;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setBusy(true);
    const previousId = field.imageFileId;
    const res = await uploadFormAsset(f);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.error) {
      setError(res.error);
      return;
    }
    onUpdate(field.id, { url: res.url, imageFileId: res.fileId });
    if (previousId && previousId !== res.fileId) {
      void deleteFormAsset(previousId);
    }
  };

  const handleRemoveUpload = () => {
    if (field.imageFileId) void deleteFormAsset(field.imageFileId);
    onUpdate(field.id, { url: "", imageFileId: undefined });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mb-[18px] flex flex-col gap-2.5">
      <label className={SUBFORM_LABEL_CLASS}>Recurso</label>

      {hasUpload ? (
        <div className="flex flex-col gap-2">
          <img
            src={field.url}
            alt="preview"
            className="max-h-[80px] max-w-[160px] self-start rounded-[7px] border border-slate-200 bg-white object-contain"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border-[1.5px] border-slate-200 bg-slate-50 px-3 py-[7px] text-[12.5px] font-semibold text-cyan-700 disabled:cursor-not-allowed"
            >
              <Icon name="upload" size={13} /> Cambiar
            </button>
            <button
              type="button"
              onClick={handleRemoveUpload}
              disabled={busy}
              className="flex-1 cursor-pointer rounded-[7px] border-none bg-red-500 px-3 py-[7px] text-[12.5px] font-semibold text-white disabled:cursor-not-allowed"
            >
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[13px] text-slate-500 disabled:cursor-wait"
        >
          <Icon name="upload" size={14} />
          {busy ? "Subiendo…" : "Seleccionar imagen"}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {error && <p className="text-[11.5px] text-red-600">{error}</p>}
      <p className="text-[11px] text-slate-400">
        Formatos: PNG, JPG, WEBP, GIF · máx. 2 MB.
      </p>
    </div>
  );
}

function OptionsTextarea({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [draft, setDraft] = useState(() => options.join("\n"));

  // Si el padre actualiza options (ej. desde otra parte del UI), reflejar
  // ese cambio EXCEPTO cuando el draft ya representa esas mismas options
  // (evita wipear una línea vacía que el user acaba de abrir).
  useEffect(() => {
    const normalized = draft.split("\n").filter(Boolean);
    const same =
      normalized.length === options.length &&
      normalized.every((v, i) => v === options[i]);
    if (!same) setDraft(options.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return (
    <textarea
      className={`${SUBFORM_INPUT_CLASS} min-h-[100px] resize-y font-sans leading-relaxed`}
      value={draft}
      placeholder={"Opción 1\nOpción 2"}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(next.split("\n").filter(Boolean));
      }}
    />
  );
}
