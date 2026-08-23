"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore, getFrontModuleId } from "@/stores/orbitStore";
import { useGestureStore, setTrackingStatus, setGestureReading, setTrackingError } from "@/stores/gestureStore";
import { HandTrackingEngine, describeTrackingError, type HandPoint } from "@/gestures/engine/handTracking";
import { pinchDistance, PINCH_THRESHOLD } from "@/gestures/classifiers/pinch";
import { publishLandmarks } from "@/gestures/landmarkFeed";

/** Degrees of carousel travel per full frame-width of hand movement. */
const ROTATION_SENSITIVITY = 300;
/** Below this, movement is hand tremor rather than intent. */
const DEADZONE = 0.0025;
/** Above this, the hand left and re-entered the frame — not a real sweep. */
const REACQUIRE_JUMP = 0.15;
/** HUD readout cadence; the detection loop itself runs every frame. */
const READOUT_INTERVAL_MS = 120;

/**
 * Optional enhancement layer on top of mouse/keyboard. Hand movement steers
 * the carousel one-to-one — the same relationship a drag has — rather than
 * requiring a flick to clear a velocity threshold, which made slow, deliberate
 * movement register as nothing at all.
 */
export function useHandTrackingAdapter() {
  const status = useGestureStore((s) => s.status);
  const engineRef = useRef<HandTrackingEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastX = useRef<number | null>(null);
  const wasPinching = useRef(false);
  const lastReadoutAt = useRef(0);

  const handleResult = useCallback((hand: HandPoint[] | null) => {
    publishLandmarks(hand);
    const now = performance.now();

    if (!hand) {
      lastX.current = null;
      wasPinching.current = false;
      if (now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
        lastReadoutAt.current = now;
        setGestureReading("no hand", 0);
      }
      return;
    }

    const wristX = hand[0][0];
    const dist = pinchDistance(hand);
    const pinching = dist < PINCH_THRESHOLD;

    if (pinching && !wasPinching.current) {
      // Toggle, so a pinch is always an escape route as well as a way in —
      // never a gesture that can only get the user deeper into a panel.
      const store = useOrbitStore.getState();
      if (store.expandedId) {
        store.dispatch({ type: "collapse", source: "gesture", confidence: 0.9 });
        setGestureReading("pinch — close", 0.9);
      } else {
        store.dispatch({ type: "expand", cardId: getFrontModuleId(), source: "gesture", confidence: 0.9 });
        setGestureReading("pinch — open", 0.9);
      }
      lastReadoutAt.current = now;
    }
    wasPinching.current = pinching;

    if (lastX.current !== null) {
      const dx = wristX - lastX.current;
      if (Math.abs(dx) > DEADZONE && Math.abs(dx) < REACQUIRE_JUMP) {
        // Negated: the camera sees the user mirrored, so a hand moving to the
        // user's right travels toward lower x in the image.
        useOrbitStore.setState((s) => ({ rotation: s.rotation - dx * ROTATION_SENSITIVITY }));
        if (!pinching && now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
          lastReadoutAt.current = now;
          const speed = Math.min(1, Math.abs(dx) / 0.03);
          setGestureReading(dx < 0 ? "hand → right" : "hand → left", speed);
        }
      } else if (!pinching && now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
        lastReadoutAt.current = now;
        setGestureReading("hand steady", 0.35);
      }
    }

    lastX.current = wristX;
  }, []);

  const enable = useCallback(async () => {
    if (engineRef.current || !videoRef.current) return;
    setTrackingStatus("starting");
    const engine = new HandTrackingEngine();
    engineRef.current = engine;
    try {
      await engine.start(videoRef.current, handleResult);
      setTrackingStatus("active");
    } catch (err) {
      engine.stop();
      engineRef.current = null;
      setTrackingError(describeTrackingError(err));
    }
  }, [handleResult]);

  const disable = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    publishLandmarks(null);
    setTrackingStatus("off");
    setGestureReading(null, 0);
  }, []);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { status, enable, disable, videoRef };
}
