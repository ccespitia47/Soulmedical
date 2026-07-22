import { create } from "zustand";
import { submitFormApi, type SubmissionData } from "../services/api";
import { randomUUID } from "../utils/uuid";

export type FormSubmission = {
  id: string;
  formId: string;
  folderId: string;
  submittedAt: string;
  submittedBy?: string;
  data: Record<string, string>;
};

interface SubmissionsState {
  submissions: FormSubmission[];
  submitting: boolean;

  addSubmission: (
    submission: Omit<FormSubmission, "id" | "submittedAt">,
    templateSnapshot?: string,
    pdfFilename?: string,
  ) => Promise<void>;
  getSubmissions: (formId: string) => FormSubmission[];
  deleteSubmission: (id: string) => void;
  clearFormSubmissions: (formId: string) => void;
}

function mapSubmission(remote: SubmissionData, folderId: string): FormSubmission {
  return {
    id: remote.id,
    formId: remote.formId,
    folderId,
    submittedAt: remote.submittedAt,
    data: remote.data as Record<string, string>,
  };
}

export const useSubmissionsStore = create<SubmissionsState>()((set, get) => ({
  submissions: [],
  submitting: false,

  addSubmission: async (submission, templateSnapshot, pdfFilename) => {
    set({ submitting: true });
    const { data, error } = await submitFormApi(
      submission.formId,
      submission.data as Record<string, unknown>,
      undefined,
      templateSnapshot,
      pdfFilename,
    );

    if (data) {
      set((state) => ({
        submissions: [...state.submissions, mapSubmission(data, submission.folderId)],
        submitting: false,
      }));
    } else {
      const fallback: FormSubmission = {
        ...submission,
        id: randomUUID(),
        submittedAt: new Date().toISOString(),
      };
      console.error("Error al guardar respuesta en servidor:", error);
      set((state) => ({
        submissions: [...state.submissions, fallback],
        submitting: false,
      }));
    }
  },

  getSubmissions: (formId) => get().submissions.filter((s) => s.formId === formId),

  deleteSubmission: (id) =>
    set((state) => ({
      submissions: state.submissions.filter((s) => s.id !== id),
    })),

  clearFormSubmissions: (formId) =>
    set((state) => ({
      submissions: state.submissions.filter((s) => s.formId !== formId),
    })),
}));