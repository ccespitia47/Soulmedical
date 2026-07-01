import type { ReactNode } from "react";

type ToolbarButtonProps = {
  title: string;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
};

const BASE =
  "flex h-9 min-w-[36px] cursor-pointer items-center justify-center rounded-md border bg-white px-2.5 text-sm";

const VARIANTS: Record<NonNullable<ToolbarButtonProps["variant"]>, string> = {
  default: "border-slate-200 text-gray-700",
  danger: "border-red-200 bg-red-50 text-red-600",
};

export default function ToolbarButton({
  title,
  onClick,
  children,
  variant = "default",
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`${BASE} ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <div className="my-1 mx-1 h-7 w-px bg-slate-200" />;
}

type ColorPickerButtonProps = {
  title: string;
  symbol: ReactNode;
  onChange: (color: string) => void;
};

export function ColorPickerButton({ title, symbol, onChange }: ColorPickerButtonProps) {
  return (
    <div
      title={title}
      className="relative flex h-9 w-9 cursor-pointer flex-col items-center justify-center rounded-md border border-slate-200 bg-white p-0"
    >
      <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center p-1">
        <div className="text-base font-semibold">{symbol}</div>
        <input
          type="color"
          onChange={(e) => onChange(e.target.value)}
          onMouseDown={(e) => e.preventDefault()}
          className="m-0 h-1.5 w-full cursor-pointer border-none p-0"
        />
      </label>
    </div>
  );
}
