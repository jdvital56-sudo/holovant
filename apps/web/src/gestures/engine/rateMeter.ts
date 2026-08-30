/**
 * Everything measured about the hand path, as it reaches the HUD: a closed
 * window plus what the camera promised before any of it started. The rate is
 * nullable here and not in a window, because the camera's promise is known a
 * whole second before the first window closes and is worth showing at once.
 */
export interface HandRateSample {
  /** Readings per second, or null until the first window has closed. */
  fps: number | null;
  /** The lowest of the last ten seconds, or null before any have closed. */
  lowFps: number | null;
  /** Mean cost of a frame with no hand in it — the palm search. */
  searchMs: number | null;
  /** Mean cost of following a hand already found, last time one was. */
  followMs: number | null;
  /** What the camera itself said it would deliver, or null if it would not say. */
  cameraFps: number | null;
  /**
   * The frame size actually negotiated, not the one requested. Part of what a
   * detection costs is moving the picture about before the model ever sees it,
   * and that part scales with pixels — so a camera that quietly ignored a
   * request for a smaller frame must not be mistaken for a smaller frame that
   * failed to help.
   */
  cameraSize: { width: number; height: number } | null;
  /**
   * Which processor is doing the looking. The library falls back from the
   * graphics card to the main processor without saying so, and on the
   * processor a detection costs several times what it should — which is one of
   * the few ways a rate sits at ten to fifteen whatever else is right.
   */
  delegate: "GPU" | "CPU" | null;
}

/** How many seconds of history the low-water mark looks back over. */
const LOW_WATER_WINDOWS = 10;

/** What one closed window of measurement found. */
export interface HandRateWindow {
  /** Distinct camera frames turned into hand readings, per second. */
  fps: number;
  /**
   * The lowest rate seen in the last ten seconds, this second included.
   *
   * One number cannot show a swing, and he read the swing rather than a value:
   * "от 10 до 15". Ten seconds rather than all time, so the first window —
   * always partial, the camera still waking — ages out instead of standing as
   * a permanent scar on the readout.
   */
  lowFps: number;
  /**
   * Mean milliseconds spent on a frame with no hand in it — a palm search,
   * which is the expensive path. Null rather than zero until one has run:
   * zero milliseconds reads as the fastest machine imaginable, which is the
   * opposite of what an unmeasured thing means.
   */
  searchMs: number | null;
  /**
   * Mean milliseconds spent following a hand already found — the cheap path,
   * and the one that decides how a gesture feels, since it is what runs while
   * he is actually gesturing.
   *
   * Carried forward from the last window that measured one. He cannot wave a
   * hand and read a line at the same moment, so the price of following has to
   * survive him lowering his hand to look. It describes the machine, not the
   * second, and machines do not change between seconds.
   */
  followMs: number | null;
}

/**
 * How many hand readings a second the machine is actually producing, and what
 * each one cost.
 *
 * Separate from the detection loop, and driven by explicit timestamps, so it
 * can be checked by simulating cameras rather than by waving at one. What it
 * counts is deliberate: **distinct camera frames**, not turns of the loop. The
 * loop can run at sixty over a camera at thirty, in which case half of what it
 * looks at is the hand it has already measured — and a loop that keeps turning
 * over a video which has stopped delivering frames would otherwise report a
 * healthy rate for a session in which nothing moves at all.
 *
 * The cost of a detection is measured alongside the rate because the two
 * together say which ceiling is holding the rate down. Fifteen readings a
 * second with detection at sixty milliseconds is a machine that cannot look
 * fast enough; fifteen with detection at five is a camera that is not sending
 * any more. The same number, and opposite cures.
 */
export class HandRateMeter {
  private windowStart: number;
  private frames = 0;
  private searches = 0;
  private searchTotalMs = 0;
  private follows = 0;
  private followTotalMs = 0;
  private lastFollowMs: number | null = null;
  private lastFrameTime: number | null = null;
  private recent: number[] = [];

  constructor(startedAt: number, private readonly windowMs = 1000) {
    this.windowStart = startedAt;
  }

  /**
   * One turn of the detection loop.
   *
   * @param now `performance.now()`
   * @param frameTime the video's `currentTime`, or null when it is holding no
   *   frame at all — a camera that has not started is a rate of zero, not an
   *   absence of information
   * @param detectMs how long this turn's detection took, null when none ran
   * @param foundHand whether that detection had a hand to follow, which is a
   *   different and far cheaper piece of work than searching for one
   * @returns the window's numbers when one closed, otherwise null
   */
  observe(
    now: number,
    frameTime: number | null,
    detectMs: number | null = null,
    foundHand = false,
  ): HandRateWindow | null {
    if (frameTime !== null && frameTime !== this.lastFrameTime) {
      this.lastFrameTime = frameTime;
      this.frames++;
    }
    if (detectMs !== null && foundHand) {
      this.follows++;
      this.followTotalMs += detectMs;
    } else if (detectMs !== null) {
      this.searches++;
      this.searchTotalMs += detectMs;
    }

    const elapsed = now - this.windowStart;
    if (elapsed < this.windowMs) return null;

    const fps = Math.round((this.frames * 1000) / elapsed);
    this.recent.push(fps);
    if (this.recent.length > LOW_WATER_WINDOWS) this.recent.shift();

    if (this.follows > 0) this.lastFollowMs = this.followTotalMs / this.follows;

    const window: HandRateWindow = {
      fps,
      lowFps: Math.min(...this.recent),
      searchMs: this.searches > 0 ? this.searchTotalMs / this.searches : null,
      followMs: this.lastFollowMs,
    };
    this.frames = 0;
    this.searches = 0;
    this.searchTotalMs = 0;
    this.follows = 0;
    this.followTotalMs = 0;
    this.windowStart = now;
    return window;
  }
}
