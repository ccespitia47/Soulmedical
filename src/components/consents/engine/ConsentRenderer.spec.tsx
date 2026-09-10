import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentRenderer from "./ConsentRenderer";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C", version: "1", logo: "" },
  sections: [{ id: "g", kind: "fields", title: "Datos", fields: [{ id: "nombres", label: "Nombres", type: "text", required: true }] }],
};
const state: ConsentState = { values: {}, firma: "", firmaResp: "", foto: "", accepted: false };

describe("ConsentRenderer", () => {
  it("renderiza campos y propaga cambios", () => {
    const onChange = vi.fn();
    render(<ConsentRenderer definition={def} state={state} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/nombres/i), { target: { value: "Ana" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ nombres: "Ana" }) }));
  });
});
