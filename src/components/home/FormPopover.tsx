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
  onShare,
}: FormPopoverProps) {
  // "Agregar tarea" ya NO va aquí: se muestra como botón propio junto a
  // "Config" en las tarjetas/filas de formulario (FormsView).
  const items = [
    { label: isFav ? "Quitar de favoritos" : "Agregar a favoritos", icon: "star", onClick: onToggleFav },
    { label: "Compartir", icon: "link", onClick: onShare },
    ...(onEdit ? [{ label: "Editar", icon: "edit", onClick: onEdit }] : []),
    { label: "Duplicar", icon: "copy", onClick: onDuplicate },
    { label: "Asignar usuarios", icon: "users", onClick: onAssign },
    ...(onDelete
      ? [{ label: "Eliminar", icon: "trash", onClick: onDelete, destructive: true }]
      : []),
  ];
  return <PopoverMenu T={T} items={items} />;
}