export type CardMotionState =
  | "idle"
  | "hovered"
  | "selected"
  | "expanded"
  | "focused"
  | "dragReturn";

export interface SpringConfig {
  tension: number;
  friction: number;
}

/**
 * One named spring per card state. No inline magic numbers in components —
 * every transition reads from here. `dragReturn` is the spring-back used
 * when a pinch releases; there is no physics engine behind it.
 */
export const CardSprings: Record<CardMotionState, SpringConfig> = {
  idle: { tension: 120, friction: 26 },
  hovered: { tension: 260, friction: 20 },
  selected: { tension: 300, friction: 24 },
  expanded: { tension: 210, friction: 26 },
  focused: { tension: 180, friction: 22 },
  dragReturn: { tension: 340, friction: 28 },
};
