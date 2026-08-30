"use client";

import { useCallback, useEffect, useRef } from "react";
import { useOrbitStore, getFrontModuleId } from "@/stores/orbitStore";
import {
  useGestureStore,
  setTrackingStatus,
  setGestureReading,
  setTrackingError,
  setLocked,
  setDetectionFps,
} from "@/stores/gestureStore";
import { HandTrackingEngine, describeTrackingError, type HandPoint } from "@/gestures/engine/handTracking";
import { pinchDistance, isPinching, smoothDistance } from "@/gestures/classifiers/pinch";

/**
 * Degrees of carousel travel per full frame-width of hand movement.
 *
 * Was 360 — a whole revolution, all sixteen cards, for one sweep of the hand,
 * and half a sweep still threw eight cards past. Movement was already
 * one-to-one with the hand; there was simply far too much of it per centimetre.
 * At 170 a comfortable sweep moves four or five cards, which is a shelf being
 * pushed rather than a wheel being spun.
 */
const ROTATION_SENSITIVITY = 170;

/**
 * A ceiling on how fast the carousel may be driven, however the readings
 * arrive. A detection stall followed by a hand somewhere else would otherwise
 * arrive as one enormous step and fling the orbit.
 */
const MAX_DEGREES_PER_SECOND = 900;

/**
 * A reading or two may go missing mid-sweep without it counting as the hand
 * leaving. Treating every dropped frame as a departure threw away the position
 * the movement was being measured from, and the sweep died in the middle —
 * which is the "sometimes it does not react at all" half of the complaint.
 */
const LOST_HAND_GRACE_MS = 320;
/** Below this, movement is hand tremor rather than intent. */
const DEADZONE = 0.0025;

/**
 * How far a hand may plausibly travel, per second, and still be the same hand.
 *
 * This was a fixed distance per frame, which quietly assumed a steady frame
 * rate. Detection runs as fast as the machine allows, and on a busy one that is
 * five or six readings a second — at which point an ordinary sweep moves
 * further between readings than the limit allowed, and every real movement was
 * thrown away as "the hand left and came back". That is what "it barely reacts
 * to my hand" was.
 */
const MAX_TRAVEL_PER_SECOND = 2.5;

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
  const lastSampleAt = useRef(0);
  const wasPinching = useRef(false);
  const smoothedPinch = useRef<number | null>(null);
  const lastReadoutAt = useRef(0);

  const handleResult = useCallback((hand: HandPoint[] | null) => {
    const now = performance.now();

    if (!hand) {
      // A brief gap is a missed reading, not a hand leaving. Only after the
      // grace period is the reference position given up.
      const goneFor = lastSampleAt.current ? now - lastSampleAt.current : Infinity;
      if (goneFor < LOST_HAND_GRACE_MS) return;

      lastX.current = null;
      lastSampleAt.current = 0;
      wasPinching.current = false;
      smoothedPinch.current = null;
      // A hand leaving frame while pinched must release the lock, or the scene
      // stays frozen with no gesture left that can free it.
      setLocked(false);
      if (now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
        lastReadoutAt.current = now;
        setGestureReading("no hand", 0);
      }
      return;
    }

    const wristX = hand[0][0];
    smoothedPinch.current = smoothDistance(smoothedPinch.current, pinchDistance(hand));
    const pinching = isPinching(smoothedPinch.current, wasPinching.current);

    if (pinching && !wasPinching.current) {
      // A pinch means "this one". It locks the carousel onto the card in front
      // — snapping it to dead centre rather than leaving it stopped between two
      // — and then opens it. Toggling on a second pinch keeps the gesture an
      // escape route as well as a way in.
      const store = useOrbitStore.getState();
      if (store.expandedId) {
        store.dispatch({ type: "collapse", source: "gesture", confidence: 0.9 });
        setGestureReading("pinch — release", 0.9);
      } else {
        store.dispatch({ type: "expand", cardId: getFrontModuleId(), source: "gesture", confidence: 0.9 });
        setGestureReading("pinch — locked", 0.95);
      }
      lastReadoutAt.current = now;
    }
    wasPinching.current = pinching;
    if (!pinching) setLocked(false);

    // While the pinch is held the carousel is frozen: hand movement is ignored
    // entirely, so holding a card still does not require holding the hand still.
    if (pinching) {
      setLocked(true);
      lastX.current = wristX;
      lastSampleAt.current = now;
      if (now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
        lastReadoutAt.current = now;
        setGestureReading("locked", 1);
      }
      return;
    }

    if (lastX.current !== null) {
      const dx = wristX - lastX.current;
      // The limit follows the gap between readings rather than assuming one:
      // slow detection means a bigger honest step, not a rejected one.
      const elapsed = lastSampleAt.current ? (now - lastSampleAt.current) / 1000 : 1 / 30;
      const plausible = MAX_TRAVEL_PER_SECOND * Math.min(0.5, Math.max(0.016, elapsed));
      if (Math.abs(dx) > DEADZONE && Math.abs(dx) < plausible) {
        // Negated: the camera sees the user mirrored, so a hand moving to the
        // user's right travels toward lower x in the image.
        const wanted = dx * ROTATION_SENSITIVITY;
        const ceiling = MAX_DEGREES_PER_SECOND * Math.min(0.5, Math.max(0.016, elapsed));
        const step = Math.sign(wanted) * Math.min(Math.abs(wanted), ceiling);
        useOrbitStore.setState((s) => ({ rotation: s.rotation - step }));
        if (now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
          lastReadoutAt.current = now;
          const speed = Math.min(1, Math.abs(dx) / 0.03);
          setGestureReading(dx < 0 ? "hand → right" : "hand → left", speed);
        }
      } else if (now - lastReadoutAt.current > READOUT_INTERVAL_MS) {
        lastReadoutAt.current = now;
        setGestureReading("hand steady", 0.35);
      }
    }

    lastX.current = wristX;
    lastSampleAt.current = now;
  }, []);

  const enable = useCallback(async () => {
    if (engineRef.current || !videoRef.current) return;
    setTrackingStatus("starting");
    const engine = new HandTrackingEngine();
    engineRef.current = engine;
    try {
      await engine.start(videoRef.current, handleResult, setDetectionFps);
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
    setLocked(false);
    setTrackingStatus("off");
    setGestureReading(null, 0);
    setDetectionFps(0);
  }, []);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { status, enable, disable, videoRef };
}
