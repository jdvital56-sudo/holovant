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

/**
 * Rotation that brings a card to the front, picked as the nearest equivalent
 * angle to where the carousel already is — otherwise selecting a card just
 * behind the front would spin almost all the way around to reach it.
 */
function rotationToCenter(cardId: string, currentRotation: number): number {
  const index = moduleRegistry.findIndex((m) => m.id === cardId);
  if (index === -1) return currentRotation;
  const base = -index * stepDeg;
  const turns = Math.round((currentRotation - base) / 360);
  return base + turns * 360;
}

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
        set((s) => ({
          selectedId: event.cardId,
          expandedId: null,
          rotation: rotationToCenter(event.cardId, s.rotation),
        }));
        return;
      case "expand":
        set((s) => ({
          selectedId: event.cardId,
          expandedId: event.cardId,
          rotation: rotationToCenter(event.cardId, s.rotation),
        }));
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

/** The module currently facing the viewer — what a gesture acts on. */
export function getFrontModuleId(): string {
  const { rotation } = useOrbitStore.getState();
  const count = moduleRegistry.length;
  const index = ((Math.round(-rotation / stepDeg) % count) + count) % count;
  return moduleRegistry[index].id;
}
