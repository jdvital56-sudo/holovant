import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { SpringConfig } from "@holovant/motion-vocabulary";

/**
 * Damped-spring approach to a scalar target — used for orbit rotation so
 * keyboard/gesture-triggered rotation steps ease in instead of snapping,
 * and dragging feels like it has a touch of momentum/lag.
 */
export function useSpringNumber(target: number, config: SpringConfig) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const velocity = useRef(0);
  const stiffness = config.tension / 1000;
  const damping = config.friction / 100;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const displacement = target - current.current;
    if (Math.abs(displacement) < 0.01 && Math.abs(velocity.current) < 0.01) {
      if (current.current !== target) {
        current.current = target;
        setValue(target);
      }
      return;
    }
    velocity.current += (displacement * stiffness - velocity.current * damping) * dt * 60;
    current.current += velocity.current * dt;
    setValue(current.current);
  });

  return value;
}
