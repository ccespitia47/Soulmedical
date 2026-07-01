import type { ReactNode } from "react";

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
};

export function ModalShell({ title, onClose, children, maxWidth = 420 }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        style={{ maxWidth }}
      >
        <h2 className="mb-5 text-lg font-bold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
        {label}
      </label>
      {children}
    </>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2.5">{children}</div>;
}
