import { useState } from "react";
import MyTwoFactorModal from "./MyTwoFactorModal";

type MyTwoFactorButtonProps = {
  /** Permite override del estilo del botón para encajar en cada layout. */
  className?: string;
};

/**
 * Botón "Mi doble factor" que abre el modal de reset propio. Se puede
 * insertar en cualquier sidebar/header. Centraliza el estado del modal
 * para que cada layout no tenga que gestionarlo aparte.
 */
export default function MyTwoFactorButton({
  className,
}: MyTwoFactorButtonProps) {
  const [open, setOpen] = useState(false);

  const defaultClass =
    "mb-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all duration-150 hover:border-[#00c2a8] hover:bg-emerald-50 hover:text-[#0f766e]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? defaultClass}
      >
        🔐 Mi doble factor
      </button>
      {open && <MyTwoFactorModal onClose={() => setOpen(false)} />}
    </>
  );
}
