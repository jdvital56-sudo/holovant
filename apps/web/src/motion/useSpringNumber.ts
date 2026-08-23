import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { SpringConfig } from "@holovant/motion-vocabulary";

/** Below this gap and speed the spring has visually arrived. */
const SETTLE_EPSILON = 0.01;

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
    const displacement = target - current.current;

    if (Math.abs(displacement) < SETTLE_EPSILON && Math.abs(velocity.current) < SETTLE_EPSILON) {
      if (current.current !== target) {
        current.current = target;
        velocity.current = 0;
        setValue(target);
      }
      return;
    }

    const acceleration = config.tension * displacement - config.friction * velocity.current;
    velocity.current += acceleration * dt;
    current.current += velocity.current * dt;
    setValue(current.current);
  });

  return value;
}
