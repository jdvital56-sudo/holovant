/**
 * Who the assistant is.
 *
 * The name is configuration, not a constant: this ships to customers who will
 * call their assistant whatever they like, and a name hard-coded through the
 * product would have to be hunted down in every string that mentions it.
 */
export const ASSISTANT_NAME =
  process.env.NEXT_PUBLIC_HOLOVANT_ASSISTANT_NAME?.trim() || "Vita";

/** Words that address the assistant directly, in either language. */
export function assistantAliases(): string[] {
  const name = ASSISTANT_NAME.toLowerCase();
  return [name, "вита", "vita"].filter((v, i, all) => all.indexOf(v) === i);
}
