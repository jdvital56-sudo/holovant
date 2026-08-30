import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { SpringConfig } from "@holovant/motion-vocabulary";

/** Below this gap and speed the spring has visually arrived. */
const SETTLE_EPSILON = 0.01;

/**
 * Longest slice the integrator will take.
 *
 * Stability needs the step under 2/√tension. At a hundred and twenty slices a
 * second this holds up to a tension of fourteen thousand — far past anything
 * this vocabulary contains — so a config can be chosen for how it feels rather
 * than for what the frame rate will survive.
 */
const MAX_STEP_SECONDS = 1 / 120;

/**
 * Damped-spring approach to a scalar target, used for orbit rotation so
 * steering eases instead of snapping and the carousel carries a little lag.
 *
 * Uses the standard spring relation `a = tension·(target − x) − friction·v`
 * with unit mass, which is what the named configs in the motion vocabulary are
 * written against — they are react-spring configs, and interpreting their
 * numbers any other way silently changes how every motion in the app feels.
 */
export function useSpringNumber(target: number, config: SpringConfig) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const velocity = useRef(0);

  useFrame((_, delta) => {
    // Clamped so a stalled tab or a long frame cannot integrate a huge step
    // and fling the carousel.
    const dt = Math.min(delta, 1 / 30);

    if (
      Math.abs(target - current.current) < SETTLE_EPSILON &&
      Math.abs(velocity.current) < SETTLE_EPSILON
    ) {
      if (current.current !== target) {
        current.current = target;
        velocity.current = 0;
        setValue(target);
      }
      return;
    }

    // Integrated in fixed slices rather than one step per frame.
    //
    // This method is only stable while the step is under 2/√tension. A stiff
    // spring — the one behind hand tracking — crosses that line the moment the
    // frame rate drops to thirty, which is exactly when hand tracking is on and
    // the machine is working hardest. Past it the value does not merely
    // overshoot: it doubles every frame and leaves for infinity, and the
    // carousel spins so fast the cards cannot be seen.
    //
    // Slicing keeps every step small whatever the frame rate, so no config can
    // blow up and none of them behave differently on a slow machine.
    const slices = Math.max(1, Math.ceil(dt / MAX_STEP_SECONDS));
    const step = dt / slices;

    for (let i = 0; i < slices; i++) {
      const acceleration = config.tension * (target - current.current) - config.friction * velocity.current;
      velocity.current += acceleration * step;
      current.current += velocity.current * step;
    }

    // Last line of defence. Nothing here should ever produce a non-finite
    // value, but a carousel that has left for infinity cannot be recovered by
    // anything the user can do.
    if (!Number.isFinite(current.current)) {
      current.current = target;
      velocity.current = 0;
    }

    setValue(current.current);
  });

  return value;
}
