import { useRef, useEffect } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== value && value !== undefined) {
        editorRef.current.innerHTML = value;
      }
    }
    isUpdatingRef.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedSelection.current) return;
    
    const selection = window.getSelection();
    if (selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedSelection.current);
      } catch (e) {
        console.warn('Could not restore selection:', e);
      }
    }
  };

  const applyColor = (type: 'text' | 'background', color: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    restoreSelection();
    
    if (type === 'text') {
      document.execCommand('foreColor', false, color);
    } else {
      document.execCommand('backColor', false, color);
    }
    
    saveSelection();
    handleInput();
  };

  const execCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    handleInput();
  };

  const buttonStyle = {
    padding: "6px 10px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    height: 36,
  };

  return (
    <div style={{
      border: "1.5px solid #e2e8f0",
      borderRadius: 8,
      background: "#fff",
      overflow: "hidden",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: 8,
        background: "#f9fafb",
        borderBottom: "1px solid #e2e8f0",
        flexWrap: "wrap",
      }}>
        {/* Tamaño de fuente */}
        <select
          onChange={(e) => execCommand('fontSize', e.target.value)}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            ...buttonStyle,
            minWidth: 60,
            fontSize: 12,
          }}
          title="Tamaño de fuente"
        >
          <option value="">Tamaño</option>
          <option value="1">10px</option>
          <option value="2">12px</option>
          <option value="3">14px</option>
          <option value="4">16px</option>
          <option value="5">18px</option>
          <option value="6">24px</option>
          <option value="7">32px</option>
        </select>

        <div style={{ width: 1, height: 28, background: "#e2e8f0", margin: "4px 4px" }} />

        {/* Negrita */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
          style={buttonStyle}
          title="Negrita (Ctrl+B)"
        >
          <strong>B</strong>
        </button>

        {/* Cursiva */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
          style={buttonStyle}
          title="Cursiva (Ctrl+I)"
        >
          <em>I</em>
        </button>

        {/* Subrayado */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
          style={buttonStyle}
          title="Subrayado (Ctrl+U)"
        >
          <u>U</u>
        </button>

        {/* Tachado */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('strikeThrough'); }}
          style={buttonStyle}
          title="Tachado"
        >
          <s>S</s>
        </button>

        <div style={{ width: 1, height: 28, background: "#e2e8f0", margin: "4px 4px" }} />

        {/* Color de texto */}
        <div
          style={{
            ...buttonStyle,
            padding: 0,
            width: 36,
            position: "relative",
            flexDirection: "column",
          }}
          title="Color de texto"
        >
          <label style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: "4px",
          }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>A</div>
            <input
              type="color"
              onChange={(e) => applyColor('text', e.target.value)}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                width: "100%",
                height: 6,
                border: "none",
                cursor: "pointer",
                padding: 0,
                margin: 0,
              }}
            />
          </label>
        </div>

        {/* Color de fondo */}
        <div
          style={{
            ...buttonStyle,
            padding: 0,
            width: 36,
            position: "relative",
            flexDirection: "column",
          }}
          title="Color de fondo/resaltado"
        >
          <label style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: "4px",
          }}>
            <div style={{ fontSize: 16 }}>🎨</div>
            <input
              type="color"
              onChange={(e) => applyColor('background', e.target.value)}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                width: "100%",
                height: 6,
                border: "none",
                cursor: "pointer",
                padding: 0,
                margin: 0,
              }}
            />
          </label>
        </div>

        <div style={{ width: 1, height: 28, background: "#e2e8f0", margin: "4px 4px" }} />

        {/* Alinear izquierda */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }}
          style={buttonStyle}
          title="Alinear a la izquierda"
        >
          ⬅
        </button>

        {/* Centrar */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }}
          style={buttonStyle}
          title="Centrar"
        >
          ↔
        </button>

        {/* Alinear derecha */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }}
          style={buttonStyle}
          title="Alinear a la derecha"
        >
          ➡
        </button>

        {/* Justificar */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }}
          style={buttonStyle}
          title="Justificar"
        >
          ⬌
        </button>

        <div style={{ width: 1, height: 28, background: "#e2e8f0", margin: "4px 4px" }} />

        {/* Lista con viñetas */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }}
          style={buttonStyle}
          title="Lista con viñetas"
        >
          • • •
        </button>

        {/* Lista numerada */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('insertOrderedList'); }}
          style={buttonStyle}
          title="Lista numerada"
        >
          1 2 3
        </button>

        <div style={{ width: 1, height: 28, background: "#e2e8f0", margin: "4px 4px" }} />

        {/* Insertar link */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt('URL del enlace:');
            if (url) execCommand('createLink', url);
          }}
          style={buttonStyle}
          title="Insertar enlace"
        >
          🔗
        </button>

        {/* Limpiar formato */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('removeFormat'); }}
          style={{
            ...buttonStyle,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
          }}
          title="Limpiar formato"
        >
          ✕
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        suppressContentEditableWarning
        style={{
          minHeight: 200,
          padding: 16,
          outline: "none",
          fontSize: 14,
          lineHeight: 1.6,
          color: "#111827",
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: '${placeholder || 'Escribe aquí...'}';
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}