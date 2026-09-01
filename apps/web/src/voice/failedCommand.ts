/**
 * A phrase that began like an order to the application itself, and matched
 * nothing.
 *
 * These are not passed to the model. Asked to stop the music in words the
 * matcher missed, it once reported cheerfully that all music was off — it had
 * done nothing, and a confident wrong answer costs more than an admission.
 *
 * The guard was one-sided, though, and he found the other side of it: "открой
 * сайт Википедии" starts with an open verb, names no module, and was answered
 * "не понял команду" while the model was sitting there with a tool for exactly
 * that. The verb list is narrower now — opening and showing are things the
 * model has hands for and should be handed, and what stays behind is the local
 * playback and volume state it cannot see and must not guess at.
 */
/**
 * Stems, matched as prefixes on purpose. They used to require a space right
 * after — `включ` then a space — which no Russian speaker ever produces, so the
 * guard sat there catching almost nothing for months while looking correct.
 */
const FAILED_COMMAND = new RegExp(
  String.raw`^(включ|выключ|выруб|останов|поставь|закрой|убери|скрой|сделай|играй|громче|тише|louder|quieter|play|close|stop)`,
);

/**
 * @param lower the transcript, lowercased, with nothing matched against it yet
 * @returns true when it should be refused rather than sent on
 */
export function looksLikeFailedCommand(lower: string): boolean {
  return FAILED_COMMAND.test(lower.trim());
}
