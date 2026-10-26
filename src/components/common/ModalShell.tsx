import type { ReactNode } from "react";
import Icon from "./Icon";
import EntityIcon from "./EntityIcon";

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  /** Si se pasa, la cabecera muestra un tile con el ícono (clave SVG o emoji). */
  icon?: string;
  /** Color de acento del tile del ícono (identidad de la entidad). */
  iconColor?: string;
  /** Subtítulo discreto bajo el título. */
  subtitle?: string;
};

export function ModalShell({
  title,
  onClose,
  children,
  maxWidth = 420,
  icon,
  iconColor = "#00c2a8",
  subtitle,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-[90vh] w-full overflow-y-auto rounded-[20px] bg-white p-6 shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]"
        style={{ maxWidth }}
      >
        <div className="mb-5 flex items-start gap-3.5">
          {icon !== undefined && (
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-[0_8px_20px_-6px_rgba(15,40,80,0.35)] transition-colors"
              style={{ background: iconColor + "1f", color: iconColor }}
            >
              <EntityIcon icon={icon} size={24} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="m-0 mt-0.5 text-[12.5px] text-gray-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
        {label}
      </label>
      {children}
    </>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2.5">{children}</div>;
}
