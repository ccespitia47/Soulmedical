import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PhotoField from "./PhotoField";

describe("PhotoField", () => {
  it("lee el archivo a data URL y llama onChange", async () => {
    const onChange = vi.fn();
    render(<PhotoField label="Foto" value="" onChange={onChange} />);
    const file = new File(["x"], "f.png", { type: "image/png" });
    const input = screen.getByLabelText(/foto/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect((onChange.mock.calls[0][0] as string).startsWith("data:")).toBe(true);
  });
});
