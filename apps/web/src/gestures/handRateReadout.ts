import type { HandRateSample } from "@/gestures/engine/rateMeter";
import type { TrackingStatus } from "@/stores/gestureStore";

/**
 * Below this a gesture feels dead however good the code is, and no amount of
 * tuning the motion will help — the fix is a faster camera path, not a better
 * spring. Which of the two problems is on this machine cannot be told from the
 * outside, so the number decides it. He read back fifteen: the floor exactly.
 */
export const SLOW_HAND_RATE = 15;

export interface HandRateReadout {
  text: string;
  /** "warn" is the machine, not the user, being at fault. */
  tone: "good" | "warn" | "quiet";
  /**
   * The line underneath: where the ceiling is, when there is one to name. It
   * explains the rate, it never replaces it.
   */
  detail: string | null;
}

/**
 * Where the ceiling is: the swing, what the camera promised, what one look
 * costs, and which processor is doing the looking.
 *
 * Omits whatever is unknown rather than printing a zero for it — a browser that
 * will not report the camera's rate must not be made to look like a camera
 * running at zero — and omits a low-water mark that is not actually low, which
 * would be the same number said twice.
 */
function describeCeiling(sample: HandRateSample | null): string | null {
  if (!sample) return null;
  const parts: string[] = [];
  if (sample.lowFps !== null && sample.fps !== null && sample.lowFps < sample.fps) {
    parts.push(`LOW ${sample.lowFps}`);
  }
  if (sample.cameraFps !== null) parts.push(`CAM ${Math.round(sample.cameraFps)}`);
  if (sample.cameraSize !== null) parts.push(`${sample.cameraSize.width}×${sample.cameraSize.height}`);
  // Searching for a hand and following one cost differently enough that a
  // single average describes neither. Only the unit is shared, so it is said
  // once, at the end of whichever prices are known.
  const prices: string[] = [];
  if (sample.searchMs !== null) prices.push(`SEARCH ${Math.round(sample.searchMs)}`);
  if (sample.followMs !== null) prices.push(`FOLLOW ${Math.round(sample.followMs)}`);
  if (prices.length > 0) parts.push(`${prices.join(" · ")} MS`);
  if (sample.delegate !== null) parts.push(sample.delegate);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * What the HUD prints for the hand rate.
 *
 * Every state is a different sentence. It used to have two — a number, and
 * "measuring…" — so a camera that never delivered a frame and a camera still
 * warming up looked identical, and a camera that froze mid-session left its
 * last good number on screen indefinitely. All three were read as "tracking is
 * on", which is how a session ran to the end with tracking dead.
 */
export function describeHandRate(status: TrackingStatus, sample: HandRateSample | null): HandRateReadout | null {
  const detail = describeCeiling(sample);
  if (status === "starting") return { text: "STARTING CAMERA…", tone: "quiet", detail };
  // An error has its own message under the button; a rate would only compete.
  if (status !== "active") return null;

  const fps = sample?.fps ?? null;
  if (fps === null) return { text: "MEASURING…", tone: "quiet", detail };
  if (fps <= 0) return { text: "NO READINGS — camera sends no frames", tone: "warn", detail };
  return { text: `${fps} HAND/S`, tone: fps < SLOW_HAND_RATE ? "warn" : "good", detail };
}
