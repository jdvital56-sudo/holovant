/**
 * Whether this video frame is one that has not been looked at yet.
 *
 * The detection loop turns on the scene's frames; the camera delivers on its
 * own. When the loop is the faster of the two — sixty turns over a camera
 * sending fifteen — three turns in four are handed the very same pixels, and
 * running hand detection over them again yields the identical hand at the cost
 * of a whole detection. On a machine whose ceiling is the main thread, that
 * waste is the ceiling.
 *
 * A frame is identified by the video's `currentTime`, which only advances when
 * the camera has actually delivered. That makes this the same rule the rate
 * meter counts by, so what gets looked at and what gets counted cannot drift —
 * provided both are given the one reading taken at the top of the turn, since
 * `currentTime` moves on while detection runs.
 */
export class FrameGate {
  private lastSeen: number | null = null;

  /** True exactly once per delivered frame; false for a repeat or no frame. */
  isNew(frameTime: number | null): boolean {
    if (frameTime === null || frameTime === this.lastSeen) return false;
    this.lastSeen = frameTime;
    return true;
  }
}
