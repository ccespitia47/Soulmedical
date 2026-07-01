import type { ThemeTokens } from "../../context/ThemeContext";
import PopoverMenu from "../common/PopoverMenu";

type FormPopoverProps = {
  T: ThemeTokens;
  isFav: boolean;
  onToggleFav: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onAssign: () => void;
  onDelete: () => void;
};

export default function FormPopover({
  T,
  isFav,
  onToggleFav,
  onEdit,
  onDuplicate,
  onAssign,
  onDelete,
}: FormPopoverProps) {
  return (
    <PopoverMenu
      T={T}
      items={[
        { label: isFav ? "Quitar de favoritos" : "Agregar a favoritos", icon: "star", onClick: onToggleFav },
        { label: "Editar", icon: "edit", onClick: onEdit },
        { label: "Duplicar", icon: "copy", onClick: onDuplicate },
        { label: "Asignar usuarios", icon: "users", onClick: onAssign },
        { label: "Eliminar", icon: "trash", onClick: onDelete, destructive: true },
      ]}
    />
  );
}
