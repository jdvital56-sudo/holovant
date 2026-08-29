import { describe, expect, it } from "vitest";
import { pinchDistance, isPinching, smoothDistance, PINCH_ENTER, PINCH_EXIT } from "./pinch";
import type { HandPoint } from "@/gestures/engine/handTracking";

/**
 * A hand, built so the pinch rule can be checked by reasoning rather than by
 * standing in front of a camera. Index 0 wrist, 4 thumb tip, 5 index knuckle,
 * 8 index tip, 9 middle knuckle, 17 little knuckle.
 */
function hand(options: { gap: number; palmLength?: number; palmWidth?: number }): HandPoint[] {
  const points: HandPoint[] = Array.from({ length: 21 }, () => [0, 0, 0]);
  const palmLength = options.palmLength ?? 0.2;
  const palmWidth = options.palmWidth ?? 0.15;

  points[0] = [0, 0, 0]; // wrist
  points[9] = [0, palmLength, 0]; // middle knuckle — palm length
  points[5] = [0, palmLength, 0]; // index knuckle
  points[17] = [palmWidth, palmLength, 0]; // little knuckle — palm width
  points[8] = [0.5, 0.5, 0]; // index tip
  points[4] = [0.5 + options.gap, 0.5, 0]; // thumb tip, `gap` away
  return points;
}

describe("measuring a pinch", () => {
  it("does not change with how close the hand is to the camera", () => {
    // The same gesture, twice the size on screen.
    const near = pinchDistance(hand({ gap: 0.04, palmLength: 0.2, palmWidth: 0.15 }));
    const far = pinchDistance(hand({ gap: 0.02, palmLength: 0.1, palmWidth: 0.075 }));
    expect(near).toBeCloseTo(far, 5);
  });

  it("survives a hand tilted towards the camera", () => {
    // Tilting foreshortens the palm's length. Taking the larger of length and
    // width keeps the scale honest; taking length alone would inflate the
    // ratio and report an obvious pinch as an open hand.
    const flat = pinchDistance(hand({ gap: 0.05, palmLength: 0.2, palmWidth: 0.15 }));
    const tilted = pinchDistance(hand({ gap: 0.05, palmLength: 0.05, palmWidth: 0.15 }));
    expect(flat).toBeLessThan(PINCH_ENTER);
    expect(tilted).toBeLessThan(PINCH_ENTER);
  });

  it("reads fingers together as pinched and fingers apart as open", () => {
    expect(pinchDistance(hand({ gap: 0.02 }))).toBeLessThan(PINCH_ENTER);
    expect(pinchDistance(hand({ gap: 0.25 }))).toBeGreaterThan(PINCH_EXIT);
  });
});

describe("holding a pinch steady", () => {
  it("needs a closer pinch to start than to keep", () => {
    expect(PINCH_ENTER).toBeLessThan(PINCH_EXIT);
  });

  it("does not flicker while the fingers hover at the boundary", () => {
    // A distance between the two thresholds keeps whatever state it was in,
    // rather than opening and closing the panel several times a second.
    const between = (PINCH_ENTER + PINCH_EXIT) / 2;
    expect(isPinching(between, true)).toBe(true);
    expect(isPinching(between, false)).toBe(false);
  });

  it("closes and releases decisively", () => {
    expect(isPinching(0.1, false)).toBe(true);
    expect(isPinching(0.9, true)).toBe(false);
  });
});

describe("smoothing", () => {
  it("takes the first reading as it is, with nothing to smooth against", () => {
    expect(smoothDistance(null, 0.3)).toBe(0.3);
  });

  it("follows a real change within two readings", () => {
    // Weighted to the newest sample: a pinch that takes three frames to
    // register is late, and late was the complaint.
    let value = smoothDistance(null, 0.9);
    value = smoothDistance(value, 0.05);
    value = smoothDistance(value, 0.05);
    expect(value).toBeLessThan(PINCH_ENTER);
  });
});
