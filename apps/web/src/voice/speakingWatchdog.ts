/**
 * A latch that lets go by itself if nobody lets go of it.
 *
 * `speaking` is raised the moment a line is requested, before the synthesis
 * request is even sent, so the microphone cannot pick up the reply while it is
 * being made. It is lowered when the audio ends. Nothing lowered it when the
 * audio never began: the fetch to /api/speak carried no timeout, so a stalled
 * Piper worker — a restart, an antivirus scanning python.exe — left `speaking`
 * true for the rest of the session. Every question is dropped while it is
 * true, so the microphone went permanently deaf with nothing on screen to say
 * so. That is the hang he has reported twice.
 *
 * The timeout on the request closes the common case. This closes the rest,
 * including the ones nobody has thought of yet, because a latch that cannot
 * stick is worth more than a list of the ways it might.
 */

/**
 * How long a line may be held with no audio playing.
 *
 * Measured on his machine: Piper synthesises a sentence in 270-450 ms and the
 * longest paragraph the assistant produces in about 1.8 s. Eight seconds is
 * far outside that, so this never fires while anything is merely slow.
 */
export const SPEAK_WATCHDOG_MS = 8000;

/**
 * Arms the watchdog.
 *
 * @param release lowers the latch; called only if `cancel` never is
 * @param ms how long to wait
 * @returns cancel, to be called as soon as audio actually starts
 */
export function armWatchdog(release: () => void, ms: number = SPEAK_WATCHDOG_MS): () => void {
  const timer = setTimeout(release, ms);
  return () => clearTimeout(timer);
}
