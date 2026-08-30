import { describe, expect, it } from "vitest";
import { delegatesToTry } from "@/gestures/engine/delegateChoice";
import { FrameGate } from "@/gestures/engine/frameGate";
import { HandRateMeter, type HandRateWindow } from "@/gestures/engine/rateMeter";
import { describeHandRate } from "@/gestures/handRateReadout";

/**
 * The number he reads back off the screen.
 *
 * He was asked for HAND/S twice and could not give it, which was the whole
 * problem: below about fifteen readings a second a gesture feels dead whatever
 * the code does, and that is a different illness with a different cure. He read
 * back **fifteen** — the floor exactly — so the rate is the fault, and the next
 * question is which of three ceilings is holding it there. Two more numbers
 * answer that, and they are measured here by arithmetic — simulated loops over
 * simulated cameras — rather than by waving at one and asking how it feels.
 *
 * Both directions live in this file. Why the old readout was useless is in the
 * first group; why it was useful at all is in the second, so a change that
 * cures one and kills the other fails here.
 */

/**
 * Runs a detection loop over a camera, exactly as `handTracking.ts` does.
 *
 * @param loopHz how often the loop turns — how fast the machine is
 * @param cameraHz how often a genuinely new frame arrives, 0 for a frozen one
 * @param seconds how long to run
 * @param detectMs how long one detection takes, null when none runs
 * @returns every window the meter closed
 */
function run({
  loopHz,
  cameraHz,
  seconds,
  frameAt = (index: number) => index,
  detectMs = 1,
}: {
  loopHz: number;
  cameraHz: number;
  seconds: number;
  frameAt?: (index: number) => number | null;
  detectMs?: number | null;
}): HandRateWindow[] {
  const meter = new HandRateMeter(0);
  const windows: HandRateWindow[] = [];
  const step = 1000 / loopHz;
  for (let now = step; now <= seconds * 1000 + 0.001; now += step) {
    // The frame the video element is holding at this instant: it only advances
    // cameraHz times a second, however often the loop looks at it.
    const index = cameraHz > 0 ? Math.floor((now / 1000) * cameraHz) : 0;
    const frameTime = frameAt(index);
    const closed = meter.observe(now, frameTime, frameTime === null ? null : detectMs, false);
    if (closed !== null) windows.push(closed);
  }
  return windows;
}

describe("what the meter must now do — the lies that made the number useless", () => {
  it("reports zero when the camera freezes, instead of leaving the last good number up", () => {
    // The trap is already written down: the video stops delivering frames, the
    // loop keeps turning, and the button still reads ON. Counting loop turns
    // would report a healthy thirty for the rest of the session.
    const meter = new HandRateMeter(0);
    let last: HandRateWindow | null = null;
    for (let now = 1000 / 60; now <= 1200; now += 1000 / 60) {
      const closed = meter.observe(now, Math.floor((now / 1000) * 30), 5, false);
      if (closed !== null) last = closed;
    }
    expect(last?.fps).toBeGreaterThan(25);

    // From here the camera is frozen: the same frame, forever.
    const frozen: HandRateWindow[] = [];
    for (let now = 1200 + 1000 / 60; now <= 5000; now += 1000 / 60) {
      const closed = meter.observe(now, 29, 5, false);
      if (closed !== null) frozen.push(closed);
    }
    // It falls to zero and stays there — the first window still carries the
    // live frames from before the freeze, which is honest.
    expect(frozen.length).toBeGreaterThanOrEqual(3);
    expect(frozen.slice(-2).map((w) => w.fps)).toEqual([0, 0]);
  });

  it("reports zero for a camera that never delivers a single frame", () => {
    // `video.videoWidth` stays zero and detection never runs. The old readout
    // said "measuring…" for as long as the page stayed open.
    const windows = run({ loopHz: 60, cameraHz: 0, seconds: 3, frameAt: () => null });
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows.every((w) => w.fps === 0)).toBe(true);
  });

  it("counts frames the camera gave, not turns the loop took", () => {
    // A loop at sixty over a camera at thirty: half of what it looks at is the
    // same hand it has already measured. Reporting sixty flatters the machine
    // and hides exactly the fault we are hunting.
    const windows = run({ loopHz: 60, cameraHz: 30, seconds: 3 });
    for (const { fps } of windows) expect(fps).toBeGreaterThanOrEqual(29);
    for (const { fps } of windows) expect(fps).toBeLessThanOrEqual(31);
  });

  it("times a detection, so a slow one can be told apart from a slow camera", () => {
    // Fifteen readings a second with detection at sixty milliseconds is a
    // machine that cannot look fast enough. Fifteen with detection at five is
    // a camera that is not sending more. Same HAND/S, opposite cures.
    const windows = run({ loopHz: 15, cameraHz: 15, seconds: 3, detectMs: 60 });
    for (const { searchMs } of windows) expect(searchMs).toBe(60);
  });

  it("averages detection over the window rather than reporting the last one", () => {
    // One slow frame in a fast second is a hiccup, not a diagnosis.
    const meter = new HandRateMeter(0);
    let closed: HandRateWindow | null = null;
    for (let turn = 1; turn <= 30; turn++) {
      const result = meter.observe((turn * 1000) / 30, turn, turn === 30 ? 200 : 10, false);
      if (result !== null) closed = result;
    }
    // Twenty-nine frames at ten and one at two hundred: about sixteen.
    expect(closed?.searchMs).toBeGreaterThan(12);
    expect(closed?.searchMs).toBeLessThan(20);
  });

  it("reports no detection time at all when nothing was detected", () => {
    // Zero milliseconds would read as "instant" — the fastest machine
    // imaginable — when what happened is that nothing ran.
    const windows = run({ loopHz: 60, cameraHz: 0, seconds: 3, frameAt: () => null });
    expect(windows.every((w) => w.searchMs === null && w.followMs === null)).toBe(true);
  });
});

describe("what the meter must still do — or the number stops meaning anything", () => {
  it("reads an ordinary camera at its own rate", () => {
    for (const cameraHz of [24, 30, 60]) {
      const windows = run({ loopHz: 120, cameraHz, seconds: 3 });
      for (const { fps } of windows) {
        expect(Math.abs(fps - cameraHz), `camera ${cameraHz} read as ${fps}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reads a slow machine as slow rather than as broken", () => {
    // This is the diagnosis he was asked for, and the answer was fifteen.
    // Eight must survive as eight — rounding it to zero would send the next
    // session hunting a dead camera that is merely slow.
    const windows = run({ loopHz: 8, cameraHz: 8, seconds: 3 });
    for (const { fps } of windows) expect(fps).toBeGreaterThanOrEqual(7);
    for (const { fps } of windows) expect(fps).toBeLessThanOrEqual(9);
  });

  it("counts the same frames however long detection takes", () => {
    // Timing detection must not change what is being timed.
    const quick = run({ loopHz: 60, cameraHz: 30, seconds: 3, detectMs: 1 });
    const slow = run({ loopHz: 60, cameraHz: 30, seconds: 3, detectMs: 90 });
    expect(quick.map((w) => w.fps)).toEqual(slow.map((w) => w.fps));
  });

  it("does not call a single dropped frame a stall", () => {
    // Twenty-nine frames where thirty were due. A meter that flapped to zero on
    // one gap would be as unreadable as one that never moved.
    const meter = new HandRateMeter(0);
    const windows: HandRateWindow[] = [];
    let frame = 0;
    for (let turn = 1; turn <= 30; turn++) {
      if (turn !== 17) frame++;
      const closed = meter.observe((turn * 1000) / 30, frame, 5, false);
      if (closed !== null) windows.push(closed);
    }
    expect(windows.map((w) => w.fps)).toEqual([29]);
  });

  it("says nothing until a whole second has been measured", () => {
    // A number that jumps every frame cannot be read aloud.
    const meter = new HandRateMeter(0);
    for (let now = 1000 / 60; now < 1000; now += 1000 / 60) {
      expect(meter.observe(now, Math.floor((now / 1000) * 30), 5, false)).toBeNull();
    }
  });

  it("comes back to a real number when the frames come back", () => {
    const meter = new HandRateMeter(0);
    for (let now = 1000 / 60; now <= 2000; now += 1000 / 60) meter.observe(now, 7, 5, false);
    const recovered: HandRateWindow[] = [];
    for (let now = 2000 + 1000 / 60; now <= 5000; now += 1000 / 60) {
      const closed = meter.observe(now, 7 + Math.floor(((now - 2000) / 1000) * 30), 5, false);
      if (closed !== null) recovered.push(closed);
    }
    expect(recovered.at(-1)?.fps).toBeGreaterThan(25);
  });
});

describe("what the screen says, so there is something to read back", () => {
  it("shows nothing at all while tracking is off", () => {
    expect(describeHandRate("off", null)).toBeNull();
    expect(describeHandRate("error", null)).toBeNull();
  });

  it("says the camera is starting rather than showing a number nobody has measured", () => {
    expect(describeHandRate("starting", null)?.text).toMatch(/starting/i);
  });

  it("says it is measuring only before the first second is up", () => {
    expect(describeHandRate("active", null)?.text).toMatch(/measuring/i);
  });

  it("never prints zero as a rate — a stall is words, not a number", () => {
    const readout = describeHandRate("active", { fps: 0, lowFps: null, searchMs: null, followMs: null, cameraFps: 30, cameraSize: null, delegate: null });
    expect(readout?.text).not.toMatch(/0\s*HAND/i);
    expect(readout?.text).toMatch(/no readings/i);
    expect(readout?.tone).toBe("warn");
  });

  it("warns below fifteen and still prints the number", () => {
    for (const fps of [1, 8, 14]) {
      const readout = describeHandRate("active", { fps, lowFps: null, searchMs: 5, followMs: null, cameraFps: 30, cameraSize: null, delegate: null });
      expect(readout?.tone, `${fps}`).toBe("warn");
      expect(readout?.text, `${fps}`).toContain(String(fps));
    }
  });

  it("is calm at fifteen and above, and still prints the number", () => {
    for (const fps of [15, 24, 30, 60]) {
      const readout = describeHandRate("active", { fps, lowFps: null, searchMs: 5, followMs: null, cameraFps: 30, cameraSize: null, delegate: null });
      expect(readout?.tone, `${fps}`).toBe("good");
      expect(readout?.text, `${fps}`).toContain(String(fps));
    }
  });

  it("puts digits in every measured readout, so a number can always be read aloud", () => {
    for (let fps = 1; fps <= 90; fps++) {
      expect(describeHandRate("active", { fps, lowFps: null, searchMs: 5, followMs: null, cameraFps: 30, cameraSize: null, delegate: null })?.text, `${fps}`).toMatch(/\d/);
    }
  });
});

describe("the line that says which ceiling is holding the rate down", () => {
  it("prints what the camera promised and what a detection costs", () => {
    const readout = describeHandRate("active", { fps: 15, lowFps: null, searchMs: 61, followMs: null, cameraFps: 30, cameraSize: null, delegate: null });
    expect(readout?.detail).toBe("CAM 30 · SEARCH 61 MS");
  });

  it("rounds the milliseconds, because a reader is not a stopwatch", () => {
    expect(describeHandRate("active", { fps: 15, lowFps: null, searchMs: 60.7, followMs: null, cameraFps: 30, cameraSize: null, delegate: null })?.detail).toContain("61 MS");
  });

  it("prints whichever half it knows and omits the half it does not", () => {
    expect(describeHandRate("active", { fps: 15, lowFps: null, searchMs: null, followMs: null, cameraFps: 30, cameraSize: null, delegate: null })?.detail).toBe("CAM 30");
    expect(describeHandRate("active", { fps: 15, lowFps: null, searchMs: 61, followMs: null, cameraFps: null, cameraSize: null, delegate: null })?.detail).toBe("SEARCH 61 MS");
  });

  it("says nothing rather than guessing when it knows neither", () => {
    // A browser that will not report the camera's rate must not be made to
    // look like a camera running at zero.
    expect(describeHandRate("active", { fps: 15, lowFps: null, searchMs: null, followMs: null, cameraFps: null, cameraSize: null, delegate: null })?.detail).toBeNull();
  });

  it("leaves the rate itself untouched — the detail explains, it does not replace", () => {
    const withDetail = describeHandRate("active", { fps: 15, lowFps: null, searchMs: 61, followMs: null, cameraFps: 30, cameraSize: null, delegate: null });
    const without = describeHandRate("active", { fps: 15, lowFps: null, searchMs: null, followMs: null, cameraFps: null, cameraSize: null, delegate: null });
    expect(withDetail?.text).toBe(without?.text);
    expect(withDetail?.tone).toBe(without?.tone);
  });

  it("carries the detail even while the rate is still being measured", () => {
    // The camera's promised rate is known the moment the stream opens, a whole
    // second before the first window closes. Withholding it would be a second
    // of blank screen for no reason.
    const readout = describeHandRate("active", { fps: null, lowFps: null, searchMs: null, followMs: null, cameraFps: 15, cameraSize: null, delegate: null });
    expect(readout?.text).toMatch(/measuring/i);
    expect(readout?.detail).toBe("CAM 15");
  });
});

/**
 * The detection loop, exactly as `handTracking.ts` runs it: one reading of the
 * video clock per turn, shared by the gate that decides whether to look and the
 * meter that counts what was looked at.
 */
function runLoop({
  loopHz,
  cameraHz,
  seconds,
  detectMs = 10,
}: {
  loopHz: number;
  cameraHz: number;
  seconds: number;
  detectMs?: number;
}) {
  const gate = new FrameGate();
  const meter = new HandRateMeter(0);
  const detected: number[] = [];
  const windows: HandRateWindow[] = [];
  const step = 1000 / loopHz;
  let turns = 0;
  for (let now = step; now <= seconds * 1000 + 0.001; now += step) {
    turns++;
    const frameTime = cameraHz > 0 ? Math.floor((now / 1000) * cameraHz) : 0;
    const fresh = gate.isNew(frameTime);
    if (fresh) detected.push(frameTime);
    const closed = meter.observe(now, frameTime, fresh ? detectMs : null, false);
    if (closed !== null) windows.push(closed);
  }
  return { detected, windows, turns };
}

describe("not looking twice at the same frame", () => {
  it("looks once per frame the camera sent, not once per turn of the loop", () => {
    // Sixty turns over a camera sending fifteen: three turns in four are handed
    // pixels already measured. Detecting them again buys the identical hand.
    const { detected, turns } = runLoop({ loopHz: 60, cameraHz: 15, seconds: 3 });
    expect(turns).toBeGreaterThan(170);
    expect(detected.length).toBeLessThanOrEqual(46);
    expect(detected.length).toBeGreaterThanOrEqual(44);
  });

  it("gives back the whole cost of every frame it skips", () => {
    // At ten milliseconds a detection, the old loop spent six hundred
    // milliseconds of every second looking at fifteen distinct frames. This is
    // the arithmetic, not a feeling about smoothness.
    const { detected } = runLoop({ loopHz: 60, cameraHz: 15, seconds: 1, detectMs: 10 });
    const spentMs = detected.length * 10;
    expect(spentMs).toBeLessThan(200);
  });

  it("misses no frame the camera did send", () => {
    const { detected } = runLoop({ loopHz: 60, cameraHz: 15, seconds: 3 });
    // Every frame index appears, once, in order.
    expect(detected).toEqual([...new Set(detected)]);
    for (let i = 1; i < detected.length; i++) expect(detected[i]).toBeGreaterThan(detected[i - 1]);
  });
});

describe("what skipping repeats must not break", () => {
  it("skips nothing at all when the loop is the slower of the two", () => {
    // The machine we may well be on: fifteen turns a second over a camera
    // sending thirty. Every turn has a new frame and every turn must look.
    const { detected, turns } = runLoop({ loopHz: 15, cameraHz: 30, seconds: 3 });
    expect(detected.length).toBe(turns);
  });

  it("still reports the rate the camera is really achieving", () => {
    const { windows } = runLoop({ loopHz: 60, cameraHz: 15, seconds: 3 });
    for (const { fps } of windows) expect(Math.abs(fps - 15)).toBeLessThanOrEqual(1);
  });

  it("keeps a frozen camera visible as zero rather than as quiet success", () => {
    // Nothing is detected, which is right — but the number must still fall, or
    // skipping repeats would have bought silence instead of speed.
    const { detected, windows } = runLoop({ loopHz: 60, cameraHz: 0, seconds: 5 });
    // One look, at the frame that was already there; nothing after it.
    expect(detected.length).toBe(1);
    expect(windows.length).toBeGreaterThanOrEqual(3);
    expect(windows.slice(-2).map((w) => w.fps)).toEqual([0, 0]);
  });

  it("charges detection time only for the frames it actually looked at", () => {
    // Averaging over skipped turns would report a machine four times faster
    // than it is, and hide the very ceiling we are hunting.
    const { windows } = runLoop({ loopHz: 60, cameraHz: 15, seconds: 3, detectMs: 40 });
    for (const { searchMs } of windows) expect(searchMs).toBe(40);
  });
});

describe("the swing, and where the ceiling is — read off the screen, not off him", () => {
  it("shows the low-water mark when the rate has been dipping", () => {
    // He reported "от 1 до 15", because one instantaneous number cannot show a
    // swing. A rate that dips to one is a different fault from a steady one.
    const readout = describeHandRate("active", {
      fps: 15,
      lowFps: 1,
      searchMs: 61, followMs: null,
      cameraFps: 30, cameraSize: null,
      delegate: "CPU",
    });
    expect(readout?.text).toBe("15 HAND/S");
    expect(readout?.detail).toBe("LOW 1 · CAM 30 · SEARCH 61 MS · CPU");
  });

  it("names the delegate, because the silent fall to the processor is the likeliest cause", () => {
    const onGpu = describeHandRate("active", { fps: 30, lowFps: 30, searchMs: 8, followMs: null, cameraFps: 30, cameraSize: null, delegate: "GPU" });
    expect(onGpu?.detail).toContain("GPU");
    const onCpu = describeHandRate("active", { fps: 4, lowFps: 1, searchMs: 240, followMs: null, cameraFps: 30, cameraSize: null, delegate: "CPU" });
    expect(onCpu?.detail).toContain("CPU");
  });

  it("says nothing about a low that is not low", () => {
    // A steady rate must not carry a second number saying the same thing.
    const readout = describeHandRate("active", {
      fps: 30,
      lowFps: 30,
      searchMs: null, followMs: null,
      cameraFps: null, cameraSize: null,
      delegate: null,
    });
    expect(readout?.detail).toBeNull();
  });

  it("still omits every half it does not know", () => {
    const readout = describeHandRate("active", {
      fps: 15,
      lowFps: null,
      searchMs: null, followMs: null,
      cameraFps: null, cameraSize: null,
      delegate: null,
    });
    expect(readout?.detail).toBeNull();
  });
});

describe("the low-water mark itself", () => {
  /**
   * Closes one window per entry, each delivering that many distinct frames.
   * The closing turn is handed a frame already seen, so it counts nothing and
   * every window lands on an exact second.
   */
  function closeWindows(meter: HandRateMeter, ratePerSecond: number[]): HandRateWindow[] {
    const closed: HandRateWindow[] = [];
    let frame = 0;
    ratePerSecond.forEach((fps, second) => {
      const base = second * 1000;
      for (let i = 0; i < fps; i++) meter.observe(base + ((i + 1) * 1000) / (fps + 1), frame++, 5, false);
      const window = meter.observe(base + 1000, frame - 1, null, false);
      if (window !== null) closed.push(window);
    });
    return closed;
  }

  it("measures each second as the second it was", () => {
    // The helper must be trusted before anything is concluded from it.
    const windows = closeWindows(new HandRateMeter(0), [12, 15, 10]);
    expect(windows.map((w) => w.fps)).toEqual([12, 15, 10]);
  });

  it("remembers the dip while the current second has recovered", () => {
    // "От 10 до 15" is a swing one instantaneous number cannot show.
    const windows = closeWindows(new HandRateMeter(0), [15, 10, 15]);
    expect(windows.at(-1)!.fps).toBe(15);
    expect(windows.at(-1)!.lowFps).toBe(10);
  });

  it("lets a dip age out, so one bad second does not stain the readout forever", () => {
    // The first window is always partial — the camera is still waking. If that
    // pinned the low-water mark for the session, the number would be a scar
    // rather than a measurement.
    const windows = closeWindows(new HandRateMeter(0), [1, ...Array<number>(12).fill(20)]);
    expect(windows.at(-1)!.lowFps).toBe(20);
  });

  it("equals the rate itself when nothing has dipped", () => {
    const windows = closeWindows(new HandRateMeter(0), [20, 20, 20]);
    for (const window of windows) expect(window.lowFps).toBe(20);
  });

  it("counts a stall as the low it was", () => {
    const windows = closeWindows(new HandRateMeter(0), [30, 0, 30]);
    expect(windows.at(-1)!.lowFps).toBe(0);
  });
});

describe("searching for a hand and following one are different prices", () => {
  /** One second of turns, each saying what it cost and whether a hand was there. */
  function second(meter: HandRateMeter, startAt: number, turns: { ms: number; hand: boolean }[]) {
    turns.forEach((turn, i) => {
      meter.observe(startAt + ((i + 1) * 1000) / (turns.length + 1), startAt + i, turn.ms, turn.hand);
    });
    return meter.observe(startAt + 1000, -startAt - 1, null, false);
  }

  it("reports the two prices apart instead of averaging them into one", () => {
    // The library runs a palm search on a frame with no hand and a cheap
    // follow on one it is already holding. Averaged, the number describes
    // neither, and the one that decides how a gesture feels is the follow.
    const meter = new HandRateMeter(0);
    const window = second(meter, 0, [
      { ms: 47, hand: false },
      { ms: 47, hand: false },
      { ms: 12, hand: true },
      { ms: 12, hand: true },
    ]);
    expect(window?.searchMs).toBe(47);
    expect(window?.followMs).toBe(12);
  });

  it("holds the last follow price through a second with the hand down", () => {
    // He cannot wave a hand and read a line at the same time. The price of
    // following survives the moment he lowers his hand to look at the screen.
    const meter = new HandRateMeter(0);
    second(meter, 0, [{ ms: 12, hand: true }, { ms: 12, hand: true }]);
    const later = second(meter, 1000, [{ ms: 47, hand: false }, { ms: 47, hand: false }]);
    expect(later?.followMs).toBe(12);
    expect(later?.searchMs).toBe(47);
  });

  it("offers no follow price until a hand has actually been followed", () => {
    // Zero would read as free. Nothing has been measured, and it says so.
    const meter = new HandRateMeter(0);
    const window = second(meter, 0, [{ ms: 47, hand: false }, { ms: 47, hand: false }]);
    expect(window?.followMs).toBeNull();
    expect(window?.searchMs).toBe(47);
  });

  it("counts the same frames whichever kind of detection ran", () => {
    const searching = new HandRateMeter(0);
    const following = new HandRateMeter(0);
    const turns = [false, true].map((hand) =>
      Array.from({ length: 15 }, () => ({ ms: 30, hand })),
    );
    expect(second(searching, 0, turns[0])?.fps).toBe(second(following, 0, turns[1])?.fps);
  });

  it("prints both prices when both are known, and one when one is", () => {
    const both = describeHandRate("active", {
      fps: 15,
      lowFps: null,
      searchMs: 47,
      followMs: 12,
      cameraFps: 30, cameraSize: null,
      delegate: "GPU",
    });
    expect(both?.detail).toBe("CAM 30 · SEARCH 47 · FOLLOW 12 MS · GPU");

    const onlyFollow = describeHandRate("active", {
      fps: 28,
      lowFps: null,
      searchMs: null,
      followMs: 12,
      cameraFps: null, cameraSize: null,
      delegate: null,
    });
    expect(onlyFollow?.detail).toBe("FOLLOW 12 MS");
  });
});

describe("which processor does the looking", () => {
  it("still tries the graphics card first and still falls back on its own", () => {
    // The shipped behaviour. A driver that refuses the graphics card must not
    // leave hand tracking dead when the processor would have worked.
    expect(delegatesToTry("GPU")).toEqual(["GPU", "CPU"]);
  });

  it("tries only the processor when the processor is what was asked for", () => {
    // Chosen to be measured against the other. Climbing quietly back to the
    // graphics card would throw away the measurement being taken.
    expect(delegatesToTry("CPU")).toEqual(["CPU"]);
  });

  it("offers at least one delegate whatever is preferred, so tracking can always start", () => {
    for (const preferred of ["GPU", "CPU"] as const) {
      expect(delegatesToTry(preferred).length).toBeGreaterThan(0);
    }
  });

  it("names the one in use, never the one asked for", () => {
    // Asking for the graphics card and being given the processor is precisely
    // the confusion this line exists to end, so the readout follows what
    // actually loaded.
    const fellBack = describeHandRate("active", {
      fps: 7,
      lowFps: 3,
      searchMs: null,
      followMs: 94,
      cameraFps: 30, cameraSize: null,
      delegate: "CPU",
    });
    expect(fellBack?.detail).toContain("CPU");
    expect(fellBack?.detail).not.toContain("GPU");
  });
});

describe("the size of the picture detection is handed", () => {
  it("prints the size the camera actually gave, beside the rate it gave", () => {
    // Asked for and given are different things, as the frame rate already
    // taught us. A camera that refuses 320x240 and sends 640x480 anyway must
    // not be mistaken for a smaller picture that failed to help.
    const readout = describeHandRate("active", {
      fps: 8,
      lowFps: 7,
      searchMs: null,
      followMs: 79,
      cameraFps: 30,
      cameraSize: { width: 320, height: 240 },
      delegate: "GPU",
    });
    expect(readout?.detail).toBe("LOW 7 · CAM 30 · 320×240 · FOLLOW 79 MS · GPU");
  });

  it("omits the size rather than inventing one when the browser will not say", () => {
    const readout = describeHandRate("active", {
      fps: 8,
      lowFps: null,
      searchMs: null,
      followMs: 79,
      cameraFps: 30,
      cameraSize: null,
      delegate: "GPU",
    });
    expect(readout?.detail).toBe("CAM 30 · FOLLOW 79 MS · GPU");
  });

  it("says the size even before a rate has been measured", () => {
    // Both are known the moment the stream opens, a whole second early.
    const readout = describeHandRate("active", {
      fps: null,
      lowFps: null,
      searchMs: null,
      followMs: null,
      cameraFps: 30,
      cameraSize: { width: 640, height: 480 },
      delegate: null,
    });
    expect(readout?.text).toMatch(/measuring/i);
    expect(readout?.detail).toBe("CAM 30 · 640×480");
  });
});
