import { create } from "zustand";

/** The card treatments, switchable live so they can be compared in place. */
export type CardStyle = "holo" | "instrument" | "glyph" | "readout";

export const CARD_STYLES: CardStyle[] = ["holo", "instrument", "glyph", "readout"];

export const CARD_STYLE_LABEL: Record<CardStyle, string> = {
  holo: "HOLOGRAM",
  instrument: "INSTRUMENT",
  glyph: "GLYPH",
  readout: "READOUT",
};

interface CardStyleState {
  style: CardStyle;
}

export const useCardStyleStore = create<CardStyleState>(() => ({
  // The projected-light treatment, chosen from the generated concepts.
  style: "holo",
}));

export function cycleCardStyle() {
  const current = useCardStyleStore.getState().style;
  const next = CARD_STYLES[(CARD_STYLES.indexOf(current) + 1) % CARD_STYLES.length];
  useCardStyleStore.setState({ style: next });
}
