import { create } from "zustand";
import type { ModuleId } from "@holovant/module-contracts";

/** `null` means the combined view across every connected account. */
type Selection = Record<string, string | null>;

interface AccountState {
  selected: Selection;
}

export const useAccountStore = create<AccountState>(() => ({ selected: {} }));

export function selectAccount(moduleId: ModuleId, accountId: string | null) {
  useAccountStore.setState((state) => ({
    selected: { ...state.selected, [moduleId]: accountId },
  }));
}

/**
 * Which account a module is showing. Defaults to the combined view: with ten
 * profiles connected, "how am I doing overall" is the question worth answering
 * before "how is this one".
 */
export function useSelectedAccount(moduleId: ModuleId): string | null {
  return useAccountStore((state) => state.selected[moduleId] ?? null);
}
