import { create } from "zustand";

interface VitaState {
  /** Whether the assistant is showing its face. */
  visible: boolean;
}

export const useVitaStore = create<VitaState>(() => ({ visible: false }));

export function showVita() {
  useVitaStore.setState({ visible: true });
}

export function hideVita() {
  useVitaStore.setState({ visible: false });
}

export function toggleVita() {
  useVitaStore.setState((s) => ({ visible: !s.visible }));
}
