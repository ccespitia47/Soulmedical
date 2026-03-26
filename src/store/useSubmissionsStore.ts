import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FormSubmission = {
  id: string;
  formId: string;
  folderId: string;
  submittedAt: string; // ISO string
  submittedBy?: string; // nombre del usuario que diligencia
  data: Record<string, string>; // widgetId → valor
};

interface SubmissionsState {
  submissions: FormSubmission[];

  addSubmission: (submission: Omit<FormSubmission, "id" | "submittedAt">) => void;
  getSubmissions: (formId: string) => FormSubmission[];
  deleteSubmission: (id: string) => void;
  clearFormSubmissions: (formId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubmissionsStore = create<SubmissionsState>()(
  persist(
    (set, get) => ({
      submissions: [],

      addSubmission: (submission) => {
        const newSubmission: FormSubmission = {
          ...submission,
          id: crypto.randomUUID(),
          submittedAt: new Date().toISOString(),
        };
        set((state) => ({
          submissions: [...state.submissions, newSubmission],
        }));
      },

      getSubmissions: (formId) => {
        return get().submissions.filter((s) => s.formId === formId);
      },

      deleteSubmission: (id) => {
        set((state) => ({
          submissions: state.submissions.filter((s) => s.id !== id),
        }));
      },

      clearFormSubmissions: (formId) => {
        set((state) => ({
          submissions: state.submissions.filter((s) => s.formId !== formId),
        }));
      },
    }),
    {
      name: "soulforms-submissions",
    }
  )
);