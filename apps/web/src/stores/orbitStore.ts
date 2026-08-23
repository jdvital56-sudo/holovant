import { create } from "zustand";
import type { InteractionEvent } from "@/gestures/types";
import { moduleRegistry } from "@/modules/registry";

export type CardVisualState = "idle" | "hovered" | "selected" | "expanded";

interface OrbitState {
  /** Target rotation in degrees; the scene spring-animates toward this. */
  rotation: number;
  hoveredId: string | null;
  selectedId: string | null;
  expandedId: string | null;
  cardState(id: string): CardVisualState;
  /** The single entry point both the mouse/keyboard adapter and a future
   * gesture adapter dispatch onto — orbit/card rendering never reads raw
   * DOM events directly. */
  dispatch(event: InteractionEvent): void;
}

const stepDeg = 360 / moduleRegistry.length;

export const useOrbitStore = create<OrbitState>((set, get) => ({
  rotation: 0,
  hoveredId: null,
  selectedId: null,
  expandedId: null,

  cardState(id) {
    const s = get();
    if (s.expandedId === id) return "expanded";
    if (s.selectedId === id) return "selected";
    if (s.hoveredId === id) return "hovered";
    return "idle";
  },

  dispatch(event) {
    switch (event.type) {
      case "rotate":
        set((s) => ({
          rotation: s.rotation + (event.direction === "left" ? -stepDeg : stepDeg),
        }));
        return;
      case "select":
        set({ selectedId: event.cardId, expandedId: null });
        return;
      case "expand":
        set({ expandedId: event.cardId, selectedId: event.cardId });
        return;
      case "collapse":
        set({ expandedId: null });
        return;
      default:
        return;
    }
  },
}));

export function setHovered(id: string | null) {
  useOrbitStore.setState({ hoveredId: id });
}
