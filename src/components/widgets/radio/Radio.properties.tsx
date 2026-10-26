import { useRef, useState } from "react";
import Icon from "../../common/Icon";
import { deleteFormAsset, uploadFormAsset } from "../../../services/formAssets";
import type { WidgetPropertiesProps } from "../../../types/widget.types";
import { newOptionId, normalizeRadioOptions, type RadioOption } from "./radioOptions";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#f8fafc",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};

const CHECKBOX_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#111827",
  cursor: "pointer",
  marginBottom: 10,
};

export default function RadioProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const options = normalizeRadioOptions(cfg.options);
  const useImageLabels = (cfg.useImageLabels as boolean) ?? false;
  const defaultValue = (cfg.defaultValue as string) || "";
  const verticalAlign = (cfg.verticalAlign as boolean) ?? true;
  const rememberInput = (cfg.rememberInput as boolean) ?? false;

  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });
  const setOptions = (next: RadioOption[]) => set({ options: next });

  const updateOption = (i: number, changes: Partial<RadioOption>) =>
    setOptions(options.map((o, idx) => (idx === i ? { ...o, ...changes } : o)));

  const addOption = () =>
    setOptions([
      ...options,
      { id: newOptionId(), label: `Opción ${options.length + 1}` },
    ]);

  const removeOption = (i: number) => {
    const removed = options[i];
    if (removed?.imageId) void deleteFormAsset(removed.imageId);
    setOptions(options.filter((_, idx) => idx !== i));
  };

  // Reordenamiento nativo con HTML5 drag-and-drop (sin lib externa).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const handleDrop = (targetIdx: number) => {
    if (dragIndex === null || dragIndex === targetIdx) return;
    const next = [...options];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIdx, 0, moved);
    setOptions(next);
    setDragIndex(null);
  };

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Usar imágenes como etiquetas */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={useImageLabels}
          onChange={(e) => set({ useImageLabels: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Usar imágenes como etiquetas</span>
      </label>

      {/* Opciones */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <label style={{ ...LABEL, marginBottom: 0 }}>Opciones</label>
          <button
            type="button"
            onClick={addOption}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1.5px solid #0891b2",
              background: "white",
              color: "#0891b2",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name="plus" size={12} /> Añadir
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((opt, i) => (
            <OptionRow
              key={opt.id}
              index={i}
              option={opt}
              useImageLabels={useImageLabels}
              onLabelChange={(label) => updateOption(i, { label })}
              onImageChange={(imageId, imageUrl) => {
                // borra la imagen anterior si había
                if (opt.imageId && opt.imageId !== imageId) {
                  void deleteFormAsset(opt.imageId);
                }
                updateOption(i, { imageId, imageUrl });
              }}
              onImageRemove={() => {
                if (opt.imageId) void deleteFormAsset(opt.imageId);
                updateOption(i, { imageId: undefined, imageUrl: undefined });
              }}
              onRemove={() => removeOption(i)}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              isDragging={dragIndex === i}
            />
          ))}
        </div>
      </div>

      {/* Valor predeterminado */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Valor predeterminado</label>
        <select
          style={INPUT}
          value={defaultValue}
          onChange={(e) => set({ defaultValue: e.target.value })}
        >
          <option value="">— Ninguno —</option>
          {options.map((o) => (
            <option key={o.id} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Alineación vertical */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={verticalAlign}
          onChange={(e) => set({ verticalAlign: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Alineación vertical</span>
      </label>

      {/* Obligatorio */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Obligatorio</span>
      </label>

      {/* Recordar entrada */}
      <label style={{ ...CHECKBOX_ROW, marginBottom: 0 }}>
        <input
          type="checkbox"
          checked={rememberInput}
          onChange={(e) => set({ rememberInput: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Recordar entrada</span>
      </label>
    </>
  );
}

type OptionRowProps = {
  index: number;
  option: RadioOption;
  useImageLabels: boolean;
  onLabelChange: (label: string) => void;
  onImageChange: (imageId: string, imageUrl: string) => void;
  onImageRemove: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragging: boolean;
};

function OptionRow({
  option,
  useImageLabels,
  onLabelChange,
  onImageChange,
  onImageRemove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: OptionRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setBusy(true);
    const res = await uploadFormAsset(f);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.error) {
      setErr(res.error);
      return;
    }
    onImageChange(res.fileId, res.url);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: 6,
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <span
        title="Arrastrar para reordenar"
        style={{
          cursor: "grab",
          color: "#94a3b8",
          padding: "0 4px",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <Icon name="grip" size={14} />
      </span>

      {useImageLabels && (
        <>
          {option.imageUrl ? (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={option.imageUrl}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "white",
                }}
              />
              <button
                type="button"
                onClick={onImageRemove}
                title="Quitar imagen"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontSize: 10,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Icon name="x" size={8} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="Añadir imagen"
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: "1.5px dashed #cbd5e1",
                background: "white",
                color: "#94a3b8",
                cursor: busy ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="upload" size={13} />
            </button>
          )}
        </>
      )}

      <input
        style={{
          flex: 1,
          padding: "6px 10px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "inherit",
          background: "white",
          color: "#111827",
          boxSizing: "border-box",
          outline: "none",
        }}
        value={option.label}
        onChange={(e) => onLabelChange(e.target.value)}
      />

      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar opción"
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          border: "none",
          background: "#fee2e2",
          color: "#ef4444",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={13} />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePick}
      />

      {err && (
        <p style={{ fontSize: 11, color: "#dc2626", margin: 0, width: "100%" }}>
          {err}
        </p>
      )}
    </div>
  );
}
