import { useEffect, useState } from "react";
import { listDrafts, deleteDraft, type FormDraft } from "../../utils/formDrafts";
import { useAuthStore } from "../../store/useAuthStore";

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
      <div className="px-6 py-20 text-center text-slate-400">
        <div className="mb-3 text-5xl">📝</div>
        <p className="text-base font-semibold">No tienes borradores</p>
        <p className="mt-1 text-[13px]">
          Cuando empieces a diligenciar un formulario sin enviarlo, se guardará
          aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      {drafts.map((d) => {
        const date = new Date(d.updatedAt);
        const filled = Object.values(d.values).filter(
          (v) => typeof v === "string" && v.trim() !== "",
        ).length;
        return (
          <div
            key={`${d.folderId}:${d.formId}`}
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    ✎ Borrador
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {filled} campo{filled !== 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="m-0 truncate text-sm font-bold text-slate-900">
                  📋 {d.formName}
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
                  className="cursor-pointer rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm"
                >
                  ▶ Continuar
                </button>
                <button
                  onClick={() => remove(d)}
                  className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                >
                  🗑 Descartar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
