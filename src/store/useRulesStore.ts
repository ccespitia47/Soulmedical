import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormRule } from "../types/widget.types";

interface RulesState {
  // Mapa formId → reglas
  rulesByForm: Record<string, FormRule[]>;
  getRules: (formId: string) => FormRule[];
  setRules: (formId: string, rules: FormRule[]) => void;
  clearRules: (formId: string) => void;
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set, get) => ({
      rulesByForm: {},

      getRules: (formId) => get().rulesByForm[formId] ?? [],

      setRules: (formId, rules) =>
        set((state) => ({
          rulesByForm: { ...state.rulesByForm, [formId]: rules },
        })),

      clearRules: (formId) =>
        set((state) => {
          const next = { ...state.rulesByForm };
          delete next[formId];
          return { rulesByForm: next };
        }),
    }),
    { name: "soulforms-rules" }
  )
);