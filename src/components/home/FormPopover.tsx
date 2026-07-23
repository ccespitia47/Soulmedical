import type { ThemeTokens } from "../../context/ThemeContext";
import PopoverMenu from "../common/PopoverMenu";

type FormPopoverProps = {
  T: ThemeTokens;
  isFav: boolean;
  onToggleFav: () => void;
  /** Si es undefined no se muestra el item (sin permiso para editar). */
  onEdit?: () => void;
  onDuplicate: () => void;
  onAssign: () => void;
  /** Si es undefined no se muestra el item (sin permiso para eliminar). */
  onDelete?: () => void;
  onCreateTask: () => void;
  onShare: () => void;
};

export default function FormPopover({
  T,
  isFav,
  onToggleFav,
  onEdit,
  onDuplicate,
  onAssign,
  onDelete,
  onCreateTask,
  onShare,
}: FormPopoverProps) {
  const items = [
    { label: isFav ? "Quitar de favoritos" : "Agregar a favoritos", icon: "star", onClick: onToggleFav },
    { label: "Compartir", icon: "link", onClick: onShare },
    { label: "Agregar tarea", icon: "clock", onClick: onCreateTask },
    ...(onEdit ? [{ label: "Editar", icon: "edit", onClick: onEdit }] : []),
    { label: "Duplicar", icon: "copy", onClick: onDuplicate },
    { label: "Asignar usuarios", icon: "users", onClick: onAssign },
    ...(onDelete
      ? [{ label: "Eliminar", icon: "trash", onClick: onDelete, destructive: true }]
      : []),
  ];
  return <PopoverMenu T={T} items={items} />;
}