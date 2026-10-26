import { useEffect, useState } from "react";
import { listDrafts, deleteDraft, type FormDraft } from "../../utils/formDrafts";
import { useAuthStore } from "../../store/useAuthStore";
import Icon from "../common/Icon";

type MyDraftsListProps = {
  onContinue: (folderId: string, formId: string) => void;
};

export default function MyDraftsList({ onContinue }: MyDraftsListProps) {
  const { currentUser } = useAuthStore();
  const [drafts, setDrafts] = useState<FormDraft[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    setDrafts(listDrafts(currentUser.id));
  }, [currentUser?.id]);

  const remove = (d: FormDraft) => {
    if (!currentUser?.id) return;
    deleteDraft(currentUser.id, d.folderId, d.formId);
    setDrafts(listDrafts(currentUser.id));
  };

  if (!currentUser?.id) {
    return (
      <div className="px-6 py-20 text-center text-sm text-slate-400">
        Necesitas iniciar sesión para ver tus borradores.
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="animate-fade-up px-6 py-20 text-center text-slate-400">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
          <Icon name="edit" size={28} />
        </div>
        <p className="text-lg font-extrabold tracking-tight text-slate-800">
          No tienes borradores
        </p>
        <p className="mt-1 text-[13px] text-slate-400">
          Cuando empieces a diligenciar un formulario sin enviarlo, se guardará
          aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      {drafts.map((d, i) => {
        const date = new Date(d.updatedAt);
        const filled = Object.values(d.values).filter(
          (v) => typeof v === "string" && v.trim() !== "",
        ).length;
        return (
          <div
            key={`${d.folderId}:${d.formId}`}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-[0_1px_3px_rgba(120,80,0,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(180,120,0,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    <Icon name="edit" size={10} /> Borrador
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {filled} campo{filled !== 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Icon name="clipboard" size={14} className="shrink-0 text-amber-500" />
                  <span className="truncate">{d.formName}</span>
                </h3>
                <p className="m-0 mt-1 text-[12px] text-slate-500">
                  Última edición:{" "}
                  {date.toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {date.toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1.5">
                <button
                  onClick={() => onContinue(d.folderId, d.formId)}
                  className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.65)]"
                >
                  <Icon name="chevronRight" size={13} /> Continuar
                </button>
                <button
                  onClick={() => remove(d)}
                  className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-red-50"
                >
                  <Icon name="trash" size={12} /> Descartar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
