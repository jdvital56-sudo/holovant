/** Where hand detection runs: the graphics card, or the main processor. */
export type Delegate = "GPU" | "CPU";

/**
 * Which delegates to try, in order, for a given preference.
 *
 * "GPU" keeps the shipped behaviour: try the graphics card, fall back to the
 * processor if the driver refuses. That fallback is why the delegate in use is
 * reported rather than assumed — asking for one and getting the other is
 * exactly the confusion the readout exists to end.
 *
 * "CPU" tries only the processor. It is chosen deliberately, to measure it
 * against the other, and a silent climb back to the graphics card would throw
 * away the measurement being taken. On this machine a detection on the
 * "graphics card" costs seventy to ninety milliseconds, several times what the
 * model should cost, which is what a second WebGL context fighting the scene's
 * looks like — and if that is what it is, the processor will be the faster of
 * the two.
 */
export function delegatesToTry(preferred: Delegate): Delegate[] {
  return preferred === "GPU" ? ["GPU", "CPU"] : ["CPU"];
}
