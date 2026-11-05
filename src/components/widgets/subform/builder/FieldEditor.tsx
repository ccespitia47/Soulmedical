import { useEffect, useRef, useState } from "react";
import type { SubformField } from "../subform.types";
import Icon from "../../../common/Icon";
import SubformFieldTypeSelect from "./SubformFieldTypeSelect";
import { deleteFormAsset, uploadFormAsset } from "../../../../services/formAssets";
import { COUNTRIES } from "../../../../lib/countries";
import { ID_DOC_COUNTRIES, ID_DOC_COUNTRY_MAP } from "../../../../lib/idDocuments";
import { sanitizeHtml } from "../../../../utils/sanitize";
import { fetchSheetsHeadersDetailed, parseSheetsUrl } from "../../search/sources/googleSheets";
import { fetchExcelHeaders } from "../../search/sources/excelWeb";
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
  /** Todos los fields del subform — necesario para los mappings de `search`
   *  (seleccionar un targetFieldId entre los otros campos del subform). */
  allFields?: SubformField[];
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
          dangerouslySetInnerHTML={{
            __html: field.htmlContent
              ? sanitizeHtml(field.htmlContent)
              : "<em>HTML vacío</em>",
          }}
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

export default function FieldEditor({
  field,
  onUpdate,
  allFields = [],
}: FieldEditorProps) {
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
    "subform",
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

      {hasOptions && !(field.type === "radio" && field.useImageLabels) && (
        <div className="mb-[18px]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <label className={`${SUBFORM_LABEL_CLASS} mb-0`}>Opciones</label>
            <span
              title="Cada opción del campo. Arrastra ☰ para reordenar y × para eliminar."
              className="flex h-[14px] w-[14px] cursor-help items-center justify-center rounded-full border border-slate-300 text-[9px] text-slate-500"
            >
              i
            </span>
          </div>
          <OptionsPerRow
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
        <>
          <div className="mb-[14px]">
            <label className={SUBFORM_LABEL_CLASS}>Código HTML</label>
            <textarea
              className={`${SUBFORM_INPUT_CLASS} min-h-[180px] resize-y font-mono text-[12px] leading-relaxed`}
              value={field.htmlContent || ""}
              placeholder="<h4>Título</h4><p>Contenido…</p>"
              spellCheck={false}
              onChange={(e) =>
                onUpdate(field.id, { htmlContent: e.target.value })
              }
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Soporta HTML completo con estilos inline. El contenido se
              sanitiza antes de renderizar (no se ejecutan scripts).
            </p>
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Vista previa</label>
            <div
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px]"
              dangerouslySetInnerHTML={{
                __html: field.htmlContent
                  ? sanitizeHtml(field.htmlContent)
                  : "<em style='color:#9ca3af'>Sin contenido</em>",
              }}
            />
          </div>
        </>
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

      {/* ── Phone: prefijo + maxLength + defaultValue + country selector ── */}
      {field.type === "phone" && (
        <>
          <div className="mb-[18px] grid grid-cols-3 gap-3">
            <div>
              <label className={SUBFORM_LABEL_CLASS}>Prefijo</label>
              <input
                className={SUBFORM_INPUT_CLASS}
                value={field.prefix || ""}
                placeholder="+57"
                disabled={field.enableCountrySelector}
                onChange={(e) =>
                  onUpdate(field.id, { prefix: e.target.value })
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
          <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.enableCountrySelector ?? false}
              onChange={(e) =>
                onUpdate(field.id, {
                  enableCountrySelector: e.target.checked,
                })
              }
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Permitir al usuario cambiar país</span>
          </label>
          {field.enableCountrySelector && (
            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>País por defecto</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.defaultCountry || "CO"}
                onChange={(e) =>
                  onUpdate(field.id, { defaultCountry: e.target.value })
                }
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.dialCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
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

      {/* ── idDocument: multi-país + thousandsSeparator (tri-estado) ── */}
      {field.type === "idDocument" && (() => {
        const countries = field.countries?.length ? field.countries : ["CO"];
        const defaultCountry = field.defaultCountry || countries[0];
        // Lectura con compat: boolean legacy → string. Default "none".
        const thousandsRaw = field.thousandsSeparator;
        const thousands: "none" | "dot" | "comma" =
          typeof thousandsRaw === "string"
            ? thousandsRaw
            : thousandsRaw === true
              ? "dot"
              : "none";

        const toggleCountry = (code: string) => {
          const next = countries.includes(code)
            ? countries.filter((c) => c !== code)
            : [...countries, code];
          if (next.length === 0) return; // siempre al menos uno
          const nextDefault = next.includes(defaultCountry) ? defaultCountry : next[0];
          onUpdate(field.id, {
            countries: next,
            defaultCountry: nextDefault,
          });
        };

        return (
          <>
            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>Países disponibles</label>
              <div className="max-h-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {ID_DOC_COUNTRIES.map((c) => {
                  const active = countries.includes(c.code);
                  return (
                    <label
                      key={c.code}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] ${active ? "font-semibold text-slate-900" : "text-slate-600"}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCountry(c.code)}
                        className="h-4 w-4 accent-[#00c2a8]"
                      />
                      <span className="text-[15px]">{c.flag}</span>
                      <span className="flex-1">{c.name}</span>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        {c.types.length} tipos
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Con un solo país activo, el usuario no ve el selector de país.
              </p>
            </div>

            {countries.length > 1 && (
              <div className="mb-[18px]">
                <label className={SUBFORM_LABEL_CLASS}>País por defecto</label>
                <select
                  className={SUBFORM_INPUT_CLASS}
                  value={defaultCountry}
                  onChange={(e) =>
                    onUpdate(field.id, { defaultCountry: e.target.value })
                  }
                >
                  {countries.map((code) => {
                    const c = ID_DOC_COUNTRY_MAP[code];
                    return c ? (
                      <option key={code} value={code}>
                        {c.flag} {c.name}
                      </option>
                    ) : null;
                  })}
                </select>
              </div>
            )}

            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>
                Separador de miles (números)
              </label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={thousands}
                onChange={(e) =>
                  onUpdate(field.id, {
                    thousandsSeparator: e.target.value as
                      | "none"
                      | "dot"
                      | "comma",
                  })
                }
              >
                <option value="none">Sin separador</option>
                <option value="dot">Punto (1.015.437.174)</option>
                <option value="comma">Coma (1,015,437,174)</option>
              </select>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Solo aplica a tipos numéricos (cédula, DNI…). En la base de
                datos el número se guarda sin separadores.
              </p>
            </div>
          </>
        );
      })()}

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

      {/* ── Search externo (Google Sheets / Excel Web / SQL) ── */}
      {field.type === "search" && (
        <SearchSourceEditor field={field} onUpdate={onUpdate} allFields={allFields} />
      )}

      {/* ── Subform anidado ── */}
      {field.type === "subform" && (
        <NestedSubformEditor field={field} onUpdate={onUpdate} />
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

      {/* ── Signature: color, grosor del trazo y assignedStep ── */}
      {field.type === "signature" && (
        <>
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
                max={5}
                className={SUBFORM_INPUT_CLASS}
                value={field.penWidth ?? 2}
                onChange={(e) => {
                  let val = parseInt(e.target.value) || 2;
                  if (val < 1) val = 1;
                  if (val > 5) val = 5;
                  onUpdate(field.id, { penWidth: val });
                }}
              />
            </div>
          </div>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>Asignar al paso</label>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="0 = cualquier paso"
              className={SUBFORM_INPUT_CLASS}
              value={field.assignedStep ?? 0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onUpdate(field.id, {
                  assignedStep: Number.isFinite(n) && n > 0 ? n : 0,
                });
              }}
            />
            <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500">
              Para tareas con varios destinatarios: número del paso (1, 2, 3…)
              en el que esta firma debe completarse. Déjalo en 0 para permitir
              que cualquiera la firme.
            </p>
          </div>
        </>
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

          <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={field.useImageLabels ?? false}
              onChange={(e) => {
                const enabled = e.target.checked;
                // Al activar, sembrar radioOptions desde options (string[]) si
                // está vacío — para no obligar al user a re-tipear etiquetas.
                const seeded =
                  enabled && (!field.radioOptions || field.radioOptions.length === 0)
                    ? (field.options || []).map((label, i) => ({
                        id: `opt_${i}_${Date.now().toString(36)}`,
                        label,
                      }))
                    : undefined;
                onUpdate(field.id, {
                  useImageLabels: enabled,
                  ...(seeded ? { radioOptions: seeded } : {}),
                });
              }}
              className="h-4 w-4 accent-[#00c2a8]"
            />
            <span>Usar imágenes como etiquetas de las opciones</span>
          </label>

          {field.useImageLabels && (
            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>Opciones con imagen</label>
              <RichRadioOptions
                options={field.radioOptions || []}
                onChange={(next) =>
                  onUpdate(field.id, { radioOptions: next })
                }
              />
            </div>
          )}

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

/**
 * UI de opciones per-row, con drag-handle ☰, input por opción y × para
 * eliminar, más botón "Añadir". Replica la UX del main Select/Checkbox
 * para que select, checkbox, radio y quiz_question del subform tengan la
 * misma edición de opciones que el formulario principal.
 *
 * Las opciones se guardan como `string[]` en field.options — la forma
 * canónica que el runtime y el schema ya esperan.
 */
function OptionsPerRow({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...options];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const update = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const add = () => {
    const next = [...options, `Opción ${options.length + 1}`];
    onChange(next);
    setTimeout(() => {
      const el = inputRefs.current[next.length - 1];
      el?.focus();
      el?.select();
    }, 0);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option, index) => {
        const isDragging = dragIdx === index;
        return (
          <div
            // key SOLO por index — incluir el texto haría que React desmonte
            // el <input> en cada tecla y el foco se pierda letra por letra.
            key={index}
            draggable
            onDragStart={() => setDragIdx(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) reorder(dragIdx, index);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            className="flex items-center gap-1.5"
            style={{ opacity: isDragging ? 0.5 : 1 }}
          >
            <span
              title="Arrastra para reordenar"
              className="cursor-grab select-none px-1 text-[14px] text-slate-400"
            >
              ☰
            </span>
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              className={`${SUBFORM_INPUT_CLASS} flex-1`}
              value={option}
              onChange={(e) => update(index, e.target.value)}
            />
            <button
              type="button"
              title="Eliminar"
              onClick={() => remove(index)}
              className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-slate-200 bg-white text-[16px] leading-none text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="mt-1 w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700"
      >
        + Añadir opción
      </button>
    </div>
  );
}

/**
 * Edición rica de opciones para el widget radio del subform cuando
 * `useImageLabels=true`: cada opción tiene label + imagen opcional
 * (upload a GridFS). Los uploads reusan /forms/assets igual que el
 * widget Image, así los cleanups también se unifican.
 */
type RichRadioOption = {
  id: string;
  label: string;
  imageUrl?: string;
  imageId?: string;
};

function RichRadioOptions({
  options,
  onChange,
}: {
  options: RichRadioOption[];
  onChange: (next: RichRadioOption[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [errorIdx, setErrorIdx] = useState<{ idx: number; msg: string } | null>(
    null,
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fileRefs = useRef<Array<HTMLInputElement | null>>([]);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...options];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const patch = (idx: number, changes: Partial<RichRadioOption>) => {
    const next = options.map((o, i) => (i === idx ? { ...o, ...changes } : o));
    onChange(next);
  };

  const remove = (idx: number) => {
    const target = options[idx];
    if (target?.imageId) void deleteFormAsset(target.imageId);
    onChange(options.filter((_, i) => i !== idx));
  };

  const add = () => {
    const next: RichRadioOption[] = [
      ...options,
      {
        id: `opt_${Math.random().toString(36).slice(2, 8)}`,
        label: `Opción ${options.length + 1}`,
      },
    ];
    onChange(next);
    setTimeout(() => {
      const el = inputRefs.current[next.length - 1];
      el?.focus();
      el?.select();
    }, 0);
  };

  const handleFile = async (idx: number, file: File) => {
    setErrorIdx(null);
    setBusyIdx(idx);
    const previousId = options[idx]?.imageId;
    const res = await uploadFormAsset(file);
    setBusyIdx(null);
    const ref = fileRefs.current[idx];
    if (ref) ref.value = "";
    if (res.error) {
      setErrorIdx({ idx, msg: res.error });
      return;
    }
    patch(idx, { imageUrl: res.url, imageId: res.fileId });
    if (previousId && previousId !== res.fileId) {
      void deleteFormAsset(previousId);
    }
  };

  const clearImage = (idx: number) => {
    const target = options[idx];
    if (target?.imageId) void deleteFormAsset(target.imageId);
    patch(idx, { imageUrl: undefined, imageId: undefined });
    const ref = fileRefs.current[idx];
    if (ref) ref.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, index) => {
        const isDragging = dragIdx === index;
        const busy = busyIdx === index;
        const err = errorIdx?.idx === index ? errorIdx.msg : null;
        return (
          <div
            key={opt.id}
            draggable
            onDragStart={() => setDragIdx(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) reorder(dragIdx, index);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
            style={{ opacity: isDragging ? 0.5 : 1 }}
          >
            <span
              title="Arrastra para reordenar"
              className="cursor-grab select-none px-1 text-[14px] text-slate-400"
            >
              ☰
            </span>

            {/* Imagen (upload o preview) */}
            <div className="flex-shrink-0">
              {opt.imageUrl ? (
                <div className="group relative">
                  <img
                    src={opt.imageUrl}
                    alt={opt.label}
                    className="h-12 w-12 rounded-md border border-slate-200 bg-white object-cover"
                  />
                  <button
                    type="button"
                    title="Quitar imagen"
                    onClick={() => clearImage(index)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-red-500 text-[11px] font-bold leading-none text-white"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRefs.current[index]?.click()}
                  title="Subir imagen"
                  className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-slate-300 bg-white text-slate-400 hover:border-cyan-600 hover:text-cyan-700 disabled:cursor-wait"
                >
                  <Icon name="image" size={16} />
                </button>
              )}
              <input
                ref={(el) => {
                  fileRefs.current[index] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(index, f);
                }}
              />
            </div>

            {/* Label editable */}
            <div className="flex flex-1 flex-col gap-0.5">
              <input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className={SUBFORM_INPUT_CLASS}
                value={opt.label}
                onChange={(e) => patch(index, { label: e.target.value })}
              />
              {err && (
                <span className="text-[11px] text-red-600">{err}</span>
              )}
              {busy && (
                <span className="text-[11px] text-slate-500">Subiendo…</span>
              )}
            </div>

            <button
              type="button"
              title="Eliminar opción"
              onClick={() => remove(index)}
              className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-slate-200 bg-white text-[16px] leading-none text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="mt-1 w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700"
      >
        + Añadir opción
      </button>
    </div>
  );
}

/**
 * Panel de configuración para el widget `search` del subform.
 *
 * Soporta google_sheets, excel_web y sql (las mismas fuentes externas del
 * main search widget). No incluye form_submissions ni group — menos útiles
 * dentro de un subform; se pueden agregar después.
 *
 * Al pegar la URL de Sheets o Excel, auto-detecta las columnas via backend
 * proxy (el fetch directo falla por CORS en Sheets publicados). Esas
 * columnas alimentan los selectores de displayColumns y de sourceField
 * en los mappings.
 *
 * Los mappings rellenan OTROS fields del mismo subform-row al seleccionar
 * un resultado en el modal. targetFieldId sale de allFields (excluyendo
 * este mismo campo).
 */
function SearchSourceEditor({
  field,
  onUpdate,
  allFields,
}: {
  field: SubformField;
  onUpdate: (id: string, changes: Partial<SubformField>) => void;
  allFields: SubformField[];
}) {
  const source = field.searchSource || "google_sheets";
  const columns = field.sheetColumns || [];
  const displayCols = field.displayColumns || [];
  const mappings = field.searchMappings || [];

  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [sheetsError, setSheetsError] = useState("");

  // Si el field aún no tiene `searchSource`, lo seedeamos a
  // "google_sheets" en el schema — si no, el user puede configurar la URL
  // sin tocar el <select> y el runtime queda sin fuente (cayendo a
  // SelectInput vacío con la option "Opción 1" huérfana).
  useEffect(() => {
    if (!field.searchSource) {
      onUpdate(field.id, { searchSource: "google_sheets" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const detectSheetsHeaders = async (url: string) => {
    setSheetsError("");
    if (!url.trim()) {
      onUpdate(field.id, { sheetColumns: [] });
      return;
    }
    setSheetsBusy(true);
    const parsed = parseSheetsUrl(url);
    const gidFromUrl = parsed?.gid ?? undefined;
    const r = await fetchSheetsHeadersDetailed(url);
    setSheetsBusy(false);
    if (r.error) {
      setSheetsError(r.error);
      return;
    }
    onUpdate(field.id, {
      sheetColumns: r.headers,
      ...(gidFromUrl ? { sheetsGid: gidFromUrl } : {}),
    });
  };

  const detectExcelHeaders = async (url: string) => {
    setSheetsError("");
    if (!url.trim()) {
      onUpdate(field.id, { sheetColumns: [] });
      return;
    }
    setSheetsBusy(true);
    const headers = await fetchExcelHeaders(url);
    setSheetsBusy(false);
    if (headers.length === 0) {
      setSheetsError("No se pudieron leer los headers del Excel.");
      return;
    }
    onUpdate(field.id, { sheetColumns: headers });
  };

  const toggleDisplayCol = (key: string) => {
    const exists = displayCols.find((c) => c.key === key);
    const next = exists
      ? displayCols.filter((c) => c.key !== key)
      : [...displayCols, { key, label: key }];
    onUpdate(field.id, { displayColumns: next });
  };

  const updateDisplayLabel = (key: string, label: string) => {
    const next = displayCols.map((c) =>
      c.key === key ? { ...c, label } : c,
    );
    onUpdate(field.id, { displayColumns: next });
  };

  const addMapping = () => {
    onUpdate(field.id, {
      searchMappings: [
        ...mappings,
        { sourceField: columns[0] || "", targetFieldId: "" },
      ],
    });
  };

  const updateMapping = (
    idx: number,
    changes: Partial<(typeof mappings)[0]>,
  ) => {
    const next = mappings.map((m, i) => (i === idx ? { ...m, ...changes } : m));
    onUpdate(field.id, { searchMappings: next });
  };

  const removeMapping = (idx: number) => {
    onUpdate(field.id, {
      searchMappings: mappings.filter((_, i) => i !== idx),
    });
  };

  const mappableFields = allFields.filter(
    (f) =>
      f.id !== field.id &&
      ![
        "header",
        "htmlblock",
        "image",
        "video",
        "signature",
        "photo",
        "file",
        "calc",
        "quiz_score",
      ].includes(f.type),
  );

  return (
    <>
      <div className="mb-[18px]">
        <label className={SUBFORM_LABEL_CLASS}>Fuente de datos</label>
        <select
          className={SUBFORM_INPUT_CLASS}
          value={source}
          onChange={(e) =>
            onUpdate(field.id, {
              searchSource: e.target.value as SubformField["searchSource"],
              sheetColumns: [],
              displayColumns: [],
              searchMappings: [],
            })
          }
        >
          <option value="google_sheets">Google Sheets</option>
          <option value="excel_web">Excel en la web (OneDrive)</option>
          <option value="sql">Consulta SQL (endpoint backend)</option>
        </select>
      </div>

      {source === "google_sheets" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>URL del Google Sheet</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.sheetsUrl || ""}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              onChange={(e) => onUpdate(field.id, { sheetsUrl: e.target.value })}
              onPaste={(e) => {
                // El evento `paste` dispara ANTES de que React actualice el
                // value — leemos la URL del clipboard y persistimos+detectamos
                // sin esperar al onBlur (que requería que el admin clickeara
                // afuera para que se auto-cargaran las columnas).
                const url = e.clipboardData.getData("text").trim();
                if (!url) return;
                onUpdate(field.id, { sheetsUrl: url });
                void detectSheetsHeaders(url);
              }}
              onBlur={(e) => void detectSheetsHeaders(e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              El Sheet debe estar "Compartir con enlace" o "Publicar en la Web".
              Al pegar la URL se detectan las columnas automáticamente.
            </p>
          </div>
          {columns.length > 0 && (
            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>Columna de búsqueda</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.sheetsSearchCol || ""}
                onChange={(e) =>
                  onUpdate(field.id, { sheetsSearchCol: e.target.value })
                }
              >
                <option value="">— Elige una columna —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {source === "excel_web" && (
        <>
          <div className="mb-[18px]">
            <label className={SUBFORM_LABEL_CLASS}>URL del Excel</label>
            <input
              className={SUBFORM_INPUT_CLASS}
              value={field.excelUrl || ""}
              placeholder="https://…/sharepoint.com/…/archivo.xlsx"
              onChange={(e) => onUpdate(field.id, { excelUrl: e.target.value })}
              onPaste={(e) => {
                const url = e.clipboardData.getData("text").trim();
                if (!url) return;
                onUpdate(field.id, { excelUrl: url });
                void detectExcelHeaders(url);
              }}
              onBlur={(e) => void detectExcelHeaders(e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              El Excel debe estar publicado en OneDrive/SharePoint. Al pegar la
              URL se detectan las columnas automáticamente.
            </p>
          </div>
          {columns.length > 0 && (
            <div className="mb-[18px]">
              <label className={SUBFORM_LABEL_CLASS}>Columna de búsqueda</label>
              <select
                className={SUBFORM_INPUT_CLASS}
                value={field.excelSearchCol || ""}
                onChange={(e) =>
                  onUpdate(field.id, { excelSearchCol: e.target.value })
                }
              >
                <option value="">— Elige una columna —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {source === "sql" && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Endpoint SQL del backend</label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.sqlEndpoint || ""}
            placeholder="/api/forms/search-source/sql/mi-consulta"
            onChange={(e) => onUpdate(field.id, { sqlEndpoint: e.target.value })}
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            El endpoint recibe <code>{"{ q: string }"}</code> y debe responder{" "}
            <code>{"{ rows: [...] }"}</code>.
          </p>
        </div>
      )}

      {sheetsBusy && (
        <p className="mb-2 text-[11.5px] text-slate-500">
          Detectando columnas…
        </p>
      )}
      {sheetsError && (
        <p className="mb-2 text-[11.5px] text-red-600">{sheetsError}</p>
      )}

      {columns.length > 0 && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Columnas a mostrar</label>
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
            {columns.map((col) => {
              const picked = displayCols.find((c) => c.key === col);
              return (
                <div key={col} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={!!picked}
                    onChange={() => toggleDisplayCol(col)}
                    className="h-4 w-4 accent-[#00c2a8]"
                  />
                  <span className="min-w-[120px] font-mono text-[12px] text-slate-600">
                    {col}
                  </span>
                  {picked && (
                    <input
                      className={`${SUBFORM_INPUT_CLASS} flex-1 py-1 text-[12px]`}
                      value={picked.label}
                      placeholder="Etiqueta visible"
                      onChange={(e) => updateDisplayLabel(col, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            El usuario ve estas columnas en el modal de resultados.
          </p>
        </div>
      )}

      <div className="mb-[18px] grid grid-cols-2 gap-3">
        <div>
          <label className={SUBFORM_LABEL_CLASS}>Mín. caracteres</label>
          <input
            type="number"
            min={0}
            max={10}
            className={SUBFORM_INPUT_CLASS}
            value={field.searchMinChars ?? 2}
            onChange={(e) =>
              onUpdate(field.id, {
                searchMinChars: parseInt(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>

      {columns.length > 0 && mappableFields.length > 0 && (
        <div className="mb-[18px]">
          <div className="mb-1.5 flex items-center justify-between">
            <label className={`${SUBFORM_LABEL_CLASS} mb-0`}>
              Rellenar otros campos al seleccionar
            </label>
            <button
              type="button"
              onClick={addMapping}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-cyan-700 hover:border-cyan-600"
            >
              + Añadir
            </button>
          </div>
          {mappings.length === 0 ? (
            <p className="text-[11.5px] text-slate-400">
              Sin mapeos. Añade uno para auto-rellenar un campo del subform con
              un valor del resultado.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {mappings.map((m, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    className={`${SUBFORM_INPUT_CLASS} flex-1 py-1 text-[12px]`}
                    value={m.sourceField}
                    onChange={(e) =>
                      updateMapping(idx, { sourceField: e.target.value })
                    }
                  >
                    <option value="">— Columna de la fuente —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400">→</span>
                  <select
                    className={`${SUBFORM_INPUT_CLASS} flex-1 py-1 text-[12px]`}
                    value={m.targetFieldId}
                    onChange={(e) =>
                      updateMapping(idx, { targetFieldId: e.target.value })
                    }
                  >
                    <option value="">— Campo del subform —</option>
                    {mappableFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label || f.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMapping(idx)}
                    className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-slate-200 bg-white text-[14px] leading-none text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Editor del subform anidado. El `SubformBuilderModal` se re-abre como
 * ventana superpuesta y el admin edita los `childFields` / `childRules`
 * del field como si fuera un subform top-level — gracias a que el modal
 * usa este mismo `FieldEditor`, la anidación funciona a N niveles sin
 * componentes adicionales (`FieldEditor` → `type==="subform"` → nuevo
 * `NestedSubformEditor` → nuevo `SubformBuilderModal`).
 *
 * Importación perezosa (require en el click) para romper el ciclo
 * FieldEditor ↔ SubformBuilderModal — ESM puede resolverlo pero algunas
 * configuraciones de Vite/HMR fallan silenciosamente, y pagar un
 * `import()` dinámico cuesta un microsegundo al abrir el modal.
 */
function NestedSubformEditor({
  field,
  onUpdate,
}: {
  field: SubformField;
  onUpdate: (id: string, changes: Partial<SubformField>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ModalLazy, setModalLazy] = useState<
    typeof import("./SubformBuilderModal").default | null
  >(null);

  const childFields = field.childFields ?? [];
  const childRules = field.childRules ?? [];

  const openEditor = async () => {
    if (!ModalLazy) {
      const mod = await import("./SubformBuilderModal");
      setModalLazy(() => mod.default);
    }
    setOpen(true);
  };

  return (
    <>
      <div className="mb-[18px] rounded-lg border-[1.5px] border-dashed border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-[13px] text-slate-700">
          <Icon name="table" size={14} />
          <span className="font-semibold">Subformulario anidado</span>
        </div>
        <p className="mb-2.5 text-[12px] text-slate-500">
          {childFields.length === 0
            ? "Sin campos configurados todavía."
            : `${childFields.length} campo(s) · ${childRules.length} regla(s).`}
        </p>
        <button
          type="button"
          onClick={() => void openEditor()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-cyan-700 hover:border-cyan-600"
        >
          <Icon name="edit" size={12} />{" "}
          {childFields.length === 0 ? "Configurar campos" : "Editar campos"}
        </button>
      </div>

      {open && ModalLazy && (
        <ModalLazy
          widgetLabel={field.label || "Subformulario anidado"}
          fields={childFields}
          rules={childRules}
          onSave={(nextFields, nextRules) => {
            onUpdate(field.id, {
              childFields: nextFields,
              childRules: nextRules,
            });
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
