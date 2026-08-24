/**
 * Synthesised, not sampled. The brief asks for a very subtle pad and short
 * confirmation blips — both are a few oscillators and an envelope, so
 * generating them avoids shipping audio assets and licensing them for a
 * product that gets sold on.
 */

export type Blip = "tick" | "open" | "close" | "confirm";

/** Root of the pad, in Hz — a low A, well under the UI blips. */
const PAD_ROOT = 55;
/** Intervals stacked over the root: octave, fifth, two octaves. */
const PAD_INTERVALS = [1, 2, 3, 4];
/** Cents of detune per voice, so the pad breathes instead of sitting still. */
const PAD_DETUNE = [-7, 4, -3, 6];
const PAD_GAIN = 0.05;
const PAD_FADE_SECONDS = 2.5;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private voices: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;

  get running() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture — browsers refuse audio otherwise. */
  async start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    await ctx.resume();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    this.master = master;

    this.buildPad(ctx, master);
  }

  private buildPad(ctx: AudioContext, master: GainNode) {
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);
    this.padGain = padGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    filter.connect(padGain);

    // Slow cutoff sweep — this is what stops the pad reading as a flat drone.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 140;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();
    this.lfo = lfo;

    PAD_INTERVALS.forEach((interval, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = PAD_ROOT * interval;
      osc.detune.value = PAD_DETUNE[i];
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1 / PAD_INTERVALS.length;
      osc.connect(voiceGain).connect(filter);
      osc.start();
      this.voices.push(osc);
    });

    padGain.gain.linearRampToValueAtTime(PAD_GAIN, ctx.currentTime + PAD_FADE_SECONDS);
  }

  /** Fades out before tearing down, so switching audio off is never a click. */
  stop() {
    const ctx = this.ctx;
    if (!ctx || !this.padGain) return;
    const endsAt = ctx.currentTime + 0.4;
    this.padGain.gain.linearRampToValueAtTime(0, endsAt);
    this.voices.forEach((v) => v.stop(endsAt));
    this.lfo?.stop(endsAt);
    this.voices = [];
    this.lfo = null;
    this.padGain = null;
    this.master = null;
    this.ctx = null;
    setTimeout(() => void ctx.close(), 600);
  }

  play(blip: Blip) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;

    let peak = 0.06;
    let duration = 0.08;

    switch (blip) {
      case "tick":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1250, now);
        filter.frequency.value = 1400;
        peak = 0.035;
        duration = 0.05;
        break;
      case "open":
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        filter.frequency.value = 900;
        duration = 0.22;
        break;
      case "close":
        osc.type = "sine";
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);
        filter.frequency.value = 700;
        duration = 0.2;
        break;
      case "confirm":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(950, now);
        filter.frequency.value = 1100;
        duration = 0.12;
        break;
    }

    // Fast attack, exponential tail — a linear fade to zero reads as a cut.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter).connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

export const audioEngine = new AudioEngine();
