import { describe, expect, it } from "vitest";

/**
 * How the orbit answers a hand, checked by simulating the spring rather than by
 * waving at a camera.
 *
 * Two complaints, opposite in direction, and both in this file so a change that
 * cures one and revives the other fails here: it spun far too fast for the
 * movement, and it carried on spinning after the hand had stopped.
 */

/** Degrees per full frame-width of hand movement, from the tracking adapter. */
const ROTATION_SENSITIVITY = 170;
/** Sixteen cards around the orbit. */
const DEGREES_PER_CARD = 360 / 16;

/** The spring the orbit uses while a hand is driving it. */
const HAND_SPRING = { tension: 900, friction: 60 };
/** The soft one behind a mouse, where coasting is wanted. */
const MOUSE_SPRING = { tension: 120, friction: 26 };

/** Seconds until the carousel has visibly stopped after its target stops. */
function secondsToSettle(jump: number, spring: { tension: number; friction: number }): number {
  let position = 0;
  let velocity = 0;
  const step = 1 / 60;
  for (let frame = 0; frame < 3600; frame++) {
    const acceleration = spring.tension * (jump - position) - spring.friction * velocity;
    velocity += acceleration * step;
    position += velocity * step;
    if (Math.abs(jump - position) < 0.5 && Math.abs(velocity) < 0.5) return (frame + 1) * step;
  }
  return Infinity;
}

function cardsMovedBy(sweepFractionOfFrame: number): number {
  return (sweepFractionOfFrame * ROTATION_SENSITIVITY) / DEGREES_PER_CARD;
}

describe("how far a sweep of the hand travels", () => {
  it("moves a handful of cards across the frame, not the whole orbit", () => {
    // At the old gain a half-frame sweep threw eight cards past — "оно очень
    // быстро крутится". A sweep is a shelf being pushed, not a wheel spun.
    expect(cardsMovedBy(0.5)).toBeGreaterThan(2);
    expect(cardsMovedBy(0.5)).toBeLessThan(5);
  });

  it("keeps a small movement small, so slow steering stays slow", () => {
    expect(cardsMovedBy(0.1)).toBeLessThan(1);
  });

  it("cannot spin the whole orbit in one sweep", () => {
    expect(cardsMovedBy(1)).toBeLessThan(8);
  });
});

describe("stopping when the hand stops", () => {
  const sweeps = [0.15, 0.3, 0.5, 0.8];

  it("settles within a fifth of a second of the hand", () => {
    for (const sweep of sweeps) {
      const degrees = sweep * ROTATION_SENSITIVITY;
      expect(secondsToSettle(degrees, HAND_SPRING), `sweep ${sweep}`).toBeLessThan(0.55);
    }
  });

  it("is decisively quicker than the spring behind a mouse", () => {
    // The soft spring carries about a second and a half after its target stops.
    // Behind a mouse that weight is the point; behind a hand it was the whole
    // complaint — the hand stopped and the orbit did not.
    const degrees = 0.5 * ROTATION_SENSITIVITY;
    expect(secondsToSettle(degrees, HAND_SPRING) * 2).toBeLessThan(
      secondsToSettle(degrees, MOUSE_SPRING),
    );
  });

  it("does not overshoot and swing back", () => {
    // Overshoot past the target reads as the carousel arguing with the hand.
    const jump = 100;
    let position = 0;
    let velocity = 0;
    let furthest = 0;
    for (let frame = 0; frame < 600; frame++) {
      const acceleration = HAND_SPRING.tension * (jump - position) - HAND_SPRING.friction * velocity;
      velocity += acceleration * (1 / 60);
      position += velocity * (1 / 60);
      furthest = Math.max(furthest, position);
    }
    expect(furthest).toBeLessThanOrEqual(jump * 1.01);
  });
});
