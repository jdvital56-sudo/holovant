import { useEffect, useRef } from "react";
import { useOrbitStore } from "@/stores/orbitStore";

/**
 * Primary, always-available interaction path: drag left/right to rotate the
 * carousel, arrow keys as a fallback. Emits the same InteractionEvent shape
 * a future MediaPipe adapter will emit — orbit/card code never sees this
 * hook directly.
 */
export function useMouseKeyboardAdapter(targetRef: React.RefObject<HTMLElement | null>) {
  const dispatch = useOrbitStore((s) => s.dispatch);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const dragDistance = useRef(0);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      dragging.current = true;
      dragDistance.current = 0;
      lastX.current = e.clientX;
      // No pointer capture here. Capturing on press sent every click to this
      // container instead of the card under the cursor, so "click the front
      // card to open it" — written on screen — never opened anything. A press
      // that has not moved yet is still a click.
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      dragDistance.current += Math.abs(dx);
      // Now it is a drag: capture, so the rotation keeps up even if the cursor
      // leaves the scene — and so the release is not taken as a click on
      // whichever card it happens to end over.
      if (dragDistance.current > DRAG_THRESHOLD_PX && !el?.hasPointerCapture(e.pointerId)) {
        el?.setPointerCapture(e.pointerId);
      }
      useOrbitStore.setState((s) => ({ rotation: s.rotation + dx * 0.3 }));
    }

    function onPointerUp() {
      dragging.current = false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") dispatch({ type: "rotate", direction: "left", source: "keyboard" });
      if (e.key === "ArrowRight") dispatch({ type: "rotate", direction: "right", source: "keyboard" });
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [targetRef, dispatch]);

  return { wasDrag: () => dragDistance.current > DRAG_THRESHOLD_PX };
}

/** Movement under this is a hand that is not quite still, not a drag. */
const DRAG_THRESHOLD_PX = 4;
