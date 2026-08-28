"use client";

/**
 * How loud the assistant is speaking, right now.
 *
 * Measured from the audio actually playing rather than faked on a timer: a
 * mouth that moves on a loop while the voice says something else is the thing
 * that makes a talking face look wrong, and no amount of animation polish
 * hides it.
 */

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let buffer: Uint8Array | null = null;
/** An element may only be connected to the graph once. */
const connected = new WeakSet<HTMLMediaElement>();

/**
 * A ring modulator sat in front of the analyser. Bypassed by default; when the
 * face is on screen its gain is driven by a low square wave, which multiplies
 * the voice against it and turns it metallic.
 */
let robotInput: GainNode | null = null;
let robotCarrier: OscillatorNode | null = null;
let robotDepth: GainNode | null = null;
let robotOn = false;

/** Smoothed, so the face breathes rather than flickering frame to frame. */
let smoothed = 0;
const RISE = 0.45;
const FALL = 0.12;

function ensureGraph(): AnalyserNode | null {
  if (typeof window === "undefined") return null;
  if (analyser) return analyser;
  try {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    buffer = new Uint8Array(analyser.frequencyBinCount);

    // Voice sources feed robotInput, which feeds the analyser, which reaches
    // the speakers. robotInput.gain is 1 (clean) until the robot is switched on.
    robotInput = context.createGain();
    robotInput.gain.value = 1;
    robotCarrier = context.createOscillator();
    // A light metallic sheen, not a Dalek: a fast-ish sine tremolo, shallow.
    robotCarrier.type = "sine";
    robotCarrier.frequency.value = 88;
    robotDepth = context.createGain();
    robotDepth.gain.value = 0;
    robotCarrier.connect(robotDepth);
    robotDepth.connect(robotInput.gain);
    robotCarrier.start();

    robotInput.connect(analyser);
    analyser.connect(context.destination);
    if (robotOn) applyRobot(true);
    return analyser;
  } catch {
    return null;
  }
}

function applyRobot(on: boolean) {
  if (!robotInput || !robotDepth) return;
  // Mostly the clean signal (0.9) with a shallow ±0.1 wobble on top — present
  // enough to read as "not quite human", nowhere near a broken low buzz.
  robotInput.gain.value = on ? 0.9 : 1;
  robotDepth.gain.value = on ? 0.1 : 0;
}

/** Turns the metallic voice on or off. Only affects the server voice, which is
 *  the one that plays through an audio element; the browser fallback cannot be
 *  routed through Web Audio. */
export function setRobotVoice(on: boolean) {
  robotOn = on;
  if (typeof window === "undefined") return;
  if (context && context.state === "suspended") void context.resume();
  applyRobot(on);
}

/**
 * Routes a playing element through the meter. Called for each spoken line;
 * the element still reaches the speakers, now by way of the robot stage and
 * the analyser.
 */
export function meterAudioElement(element: HTMLMediaElement) {
  const node = ensureGraph();
  if (!node || !context || !robotInput) return;
  if (connected.has(element)) return;
  try {
    const source = context.createMediaElementSource(element);
    source.connect(robotInput);
    connected.add(element);
    // Browsers suspend contexts created outside a gesture; playback itself is
    // the gesture's consequence, so resuming here is enough.
    void context.resume();
  } catch {
    // Already connected elsewhere, or the element is cross-origin. The face
    // falls back to its idle motion rather than the voice failing.
  }
}

/** 0..1. Zero when nothing is playing. */
export function voiceLevel(): number {
  if (!analyser || !buffer) return decay();
  analyser.getByteFrequencyData(buffer as Uint8Array<ArrayBuffer>);

  // Averaged over the low and mid bands, where speech energy actually sits;
  // the full spectrum is mostly silence and drags the reading down.
  const bins = Math.floor(buffer.length * 0.4);
  let total = 0;
  for (let i = 0; i < bins; i++) total += buffer[i];
  const raw = Math.min(1, total / bins / 160);

  const rate = raw > smoothed ? RISE : FALL;
  smoothed += (raw - smoothed) * rate;
  return smoothed;
}

function decay(): number {
  smoothed *= 1 - FALL;
  return smoothed;
}
