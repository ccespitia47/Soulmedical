import ToolbarButton, { ToolbarDivider, ColorPickerButton } from "./ToolbarButton";

const FONT_SIZES = [
  { value: "1", label: "10px" },
  { value: "2", label: "12px" },
  { value: "3", label: "14px" },
  { value: "4", label: "16px" },
  { value: "5", label: "18px" },
  { value: "6", label: "24px" },
  { value: "7", label: "32px" },
];

type ToolbarProps = {
  onCommand: (command: string, value?: string) => void;
  onApplyColor: (type: "text" | "background", color: string) => void;
  onInsertLink: () => void;
};

export default function Toolbar({ onCommand, onApplyColor, onInsertLink }: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-gray-50 p-2">
      <select
        onChange={(e) => onCommand("fontSize", e.target.value)}
        onMouseDown={(e) => e.preventDefault()}
        title="Tamaño de fuente"
        className="h-9 min-w-[60px] cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 text-xs text-gray-700"
      >
        <option value="">Tamaño</option>
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <ToolbarDivider />

      <ToolbarButton title="Negrita (Ctrl+B)" onClick={() => onCommand("bold")}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton title="Cursiva (Ctrl+I)" onClick={() => onCommand("italic")}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton title="Subrayado (Ctrl+U)" onClick={() => onCommand("underline")}>
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton title="Tachado" onClick={() => onCommand("strikeThrough")}>
        <s>S</s>
      </ToolbarButton>

      <ToolbarDivider />

      <ColorPickerButton
        title="Color de texto"
        symbol="A"
        onChange={(c) => onApplyColor("text", c)}
      />
      <ColorPickerButton
        title="Color de fondo/resaltado"
        symbol="🎨"
        onChange={(c) => onApplyColor("background", c)}
      />

      <ToolbarDivider />

      <ToolbarButton title="Alinear a la izquierda" onClick={() => onCommand("justifyLeft")}>
        ⬅
      </ToolbarButton>
      <ToolbarButton title="Centrar" onClick={() => onCommand("justifyCenter")}>
        ↔
      </ToolbarButton>
      <ToolbarButton title="Alinear a la derecha" onClick={() => onCommand("justifyRight")}>
        ➡
      </ToolbarButton>
      <ToolbarButton title="Justificar" onClick={() => onCommand("justifyFull")}>
        ⬌
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Lista con viñetas"
        onClick={() => onCommand("insertUnorderedList")}
      >
        • • •
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" onClick={() => onCommand("insertOrderedList")}>
        1 2 3
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Insertar enlace" onClick={onInsertLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton
        title="Limpiar formato"
        onClick={() => onCommand("removeFormat")}
        variant="danger"
      >
        ✕
      </ToolbarButton>
    </div>
  );
}
