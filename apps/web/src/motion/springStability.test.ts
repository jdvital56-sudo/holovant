import { describe, expect, it } from "vitest";
import { CardSprings } from "@holovant/motion-vocabulary";

/**
 * A spring must not leave for infinity when the frame rate drops.
 *
 * This is the test that was missing. A stiff config was chosen for how quickly
 * it settled at sixty frames a second, and nothing checked what it did at
 * thirty — which is exactly where the machine sits when hand tracking is on and
 * it is working hardest. Past the stability limit the value does not overshoot,
 * it doubles every frame: the carousel span so fast the cards could not be
 * seen, and no gesture could stop it.
 *
 * Every config in the vocabulary is checked here, at every frame rate the app
 * can reach, so choosing a config for how it feels can never again be a choice
 * about whether the maths survives.
 */

/** Longest slice the integrator takes, from useSpringNumber. */
const MAX_STEP_SECONDS = 1 / 120;
/** The frame-time clamp in useSpringNumber. */
const FRAME_CLAMP = 1 / 30;

/** The orbit's spring while a hand is driving it, from OrbitController. */
const HAND_SPRING = { tension: 500, friction: 50 };

interface Run {
  settledAfter: number | null;
  furthest: number;
  finite: boolean;
}

/** Integrates exactly as useSpringNumber does, slices included. */
function simulate(
  spring: { tension: number; friction: number },
  frameSeconds: number,
  target = 50,
): Run {
  let position = 0;
  let velocity = 0;
  let furthest = 0;
  const dt = Math.min(frameSeconds, FRAME_CLAMP);
  const slices = Math.max(1, Math.ceil(dt / MAX_STEP_SECONDS));
  const step = dt / slices;

  for (let frame = 0; frame < 1200; frame++) {
    for (let i = 0; i < slices; i++) {
      const acceleration = spring.tension * (target - position) - spring.friction * velocity;
      velocity += acceleration * step;
      position += velocity * step;
    }
    furthest = Math.max(furthest, Math.abs(position));
    if (!Number.isFinite(position)) return { settledAfter: null, furthest, finite: false };
    if (Math.abs(target - position) < 0.5 && Math.abs(velocity) < 0.5) {
      return { settledAfter: (frame + 1) * frameSeconds, furthest, finite: true };
    }
  }
  return { settledAfter: null, furthest, finite: true };
}

/** Every rate the app actually runs at, including the ones it degrades to. */
const FRAME_RATES = [60, 45, 30, 24, 20, 15, 12, 8];

const ALL_SPRINGS: Array<[name: string, spring: { tension: number; friction: number }]> = [
  ...Object.entries(CardSprings).map(
    ([name, spring]) => [name, spring] as [string, { tension: number; friction: number }],
  ),
  ["handTracking", HAND_SPRING],
];

describe("no spring runs away when the frame rate drops", () => {
  for (const [name, spring] of ALL_SPRINGS) {
    for (const fps of FRAME_RATES) {
      it(`${name} stays finite at ${fps} frames a second`, () => {
        const run = simulate(spring, 1 / fps);
        expect(run.finite, `${name} @ ${fps}fps`).toBe(true);
      });
    }
  }

  for (const [name, spring] of ALL_SPRINGS) {
    it(`${name} never swings wildly past its target`, () => {
      for (const fps of FRAME_RATES) {
        const run = simulate(spring, 1 / fps, 50);
        // Twice the target is generous for a damped spring and nowhere near
        // the doubling-every-frame that broke it.
        expect(run.furthest, `${name} @ ${fps}fps`).toBeLessThan(100);
      }
    });
  }
});

describe("the hand spring settles quickly at every rate", () => {
  for (const fps of [60, 45, 30]) {
    it(`stops within a second at ${fps} frames a second`, () => {
      const run = simulate(HAND_SPRING, 1 / fps);
      expect(run.settledAfter, `${fps}fps`).not.toBeNull();
      expect(run.settledAfter ?? Infinity).toBeLessThan(1);
    });
  }

  it("runs in slow motion below thirty, which is the frame clamp's price", () => {
    // Frame time is clamped at a thirtieth of a second, so below that rate the
    // spring advances less simulated time than real time passes and the motion
    // stretches. That is deliberate — an unclamped step is what lets a long
    // frame integrate an enormous jump — but it is worth naming: at fifteen
    // frames a second the carousel takes twice as long to come to rest, and it
    // is slower rather than broken.
    const run = simulate(HAND_SPRING, 1 / 15);
    expect(run.finite).toBe(true);
    expect(run.settledAfter ?? Infinity).toBeLessThan(2);
  });

  it("stops decisively sooner than the spring behind a mouse", () => {
    const hand = simulate(HAND_SPRING, 1 / 60).settledAfter ?? Infinity;
    const mouse = simulate(CardSprings.idle, 1 / 60).settledAfter ?? Infinity;
    expect(hand * 1.5).toBeLessThan(mouse);
  });
});
