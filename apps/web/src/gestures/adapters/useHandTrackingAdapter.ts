"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { useGestureStore, setTrackingStatus, setGestureReading, setTrackingError } from "@/stores/gestureStore";
import { HandTrackingEngine, describeTrackingError, type HandPoint } from "@/gestures/engine/handTracking";
import { pinchDistance, PINCH_THRESHOLD } from "@/gestures/classifiers/pinch";

const SWIPE_VELOCITY_THRESHOLD = 1.4; // normalized-x units per second
const SWIPE_COOLDOWN_MS = 550;
const STILL_VELOCITY_THRESHOLD = 0.06;
const STILL_HOLD_MS = 800;

/**
 * Optional enhancement layer on top of mouse/keyboard. Dispatches the same
 * InteractionEvent shape the mouse adapter uses, so orbit/card code never
 * needs to know whether input came from a pointer or a hand.
 */
export function useHandTrackingAdapter() {
  const status = useGestureStore((s) => s.status);
  const engineRef = useRef<HandTrackingEngine | null>(null);
  const lastX = useRef<number | null>(null);
  const lastT = useRef<number>(0);
  const swipeCooldownUntil = useRef(0);
  const stillSince = useRef<number | null>(null);
  const wasPinching = useRef(false);
  const pinchBaseX = useRef(0);

  const handleResult = useCallback((hand: HandPoint[] | null) => {
    const now = performance.now();

    if (!hand) {
      setGestureReading(null, 0);
      lastX.current = null;
      stillSince.current = null;
      wasPinching.current = false;
      return;
    }

    const wristX = hand[0][0];
    const dist = pinchDistance(hand);
    const pinching = dist < PINCH_THRESHOLD;
    const pinchConfidence = Math.max(0, Math.min(1, 1 - dist / PINCH_THRESHOLD));

    if (pinching) {
      if (!wasPinching.current) pinchBaseX.current = wristX;
      const dx = wristX - pinchBaseX.current;
      pinchBaseX.current = wristX;
      useOrbitStore.setState((s) => ({ rotation: s.rotation - dx * 220 }));
      setGestureReading("pinch — drag", pinchConfidence);
      wasPinching.current = true;
      lastX.current = wristX;
      lastT.current = now;
      stillSince.current = null;
      return;
    }
    wasPinching.current = false;

    if (lastX.current !== null) {
      const dt = Math.max(1, now - lastT.current) / 1000;
      const velocity = (wristX - lastX.current) / dt;

      if (Math.abs(velocity) > SWIPE_VELOCITY_THRESHOLD && now > swipeCooldownUntil.current) {
        const direction = velocity > 0 ? "left" : "right"; // mirrored: hand moving right = card sweeps left
        useOrbitStore.getState().dispatch({ type: "rotate", direction, source: "gesture", confidence: 0.8 });
        setGestureReading(`swipe ${direction}`, 0.8);
        swipeCooldownUntil.current = now + SWIPE_COOLDOWN_MS;
        stillSince.current = null;
      } else if (Math.abs(velocity) < STILL_VELOCITY_THRESHOLD) {
        if (stillSince.current === null) stillSince.current = now;
        if (now - stillSince.current > STILL_HOLD_MS) {
          setGestureReading("palm still", 0.7);
        }
      } else {
        stillSince.current = null;
        if (now > swipeCooldownUntil.current) setGestureReading("tracking", 0.4);
      }
    }

    lastX.current = wristX;
    lastT.current = now;
  }, []);

  const enable = useCallback(async () => {
    if (engineRef.current) return;
    setTrackingStatus("starting");
    const engine = new HandTrackingEngine();
    engineRef.current = engine;
    try {
      await engine.start(handleResult);
      setTrackingStatus("active");
    } catch (err) {
      engineRef.current = null;
      setTrackingError(describeTrackingError(err));
    }
  }, [handleResult]);

  const disable = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setTrackingStatus("off");
    setGestureReading(null, 0);
  }, []);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { status, enable, disable };
}
