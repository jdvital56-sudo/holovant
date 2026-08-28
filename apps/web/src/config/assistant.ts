/**
 * Who the assistant is.
 *
 * The name is configuration, not a constant: this ships to customers who will
 * call their assistant whatever they like, and a name hard-coded through the
 * product would have to be hunted down in every string that mentions it.
 */
export const ASSISTANT_NAME =
  process.env.NEXT_PUBLIC_HOLOVANT_ASSISTANT_NAME?.trim() || "Thor";

/**
 * Spellings a recogniser might produce for the name, since it transcribes what
 * it hears rather than what was meant — "Thor" comes back as "тор", "тхор" or
 * "thor" depending on the accent and the language it is listening in. Extra
 * spellings can be added without a code change through
 * NEXT_PUBLIC_HOLOVANT_ASSISTANT_ALIASES, comma separated.
 */
const BUILT_IN_ALIASES: Record<string, string[]> = {
  thor: ["тор", "тхор", "торр", "thor"],
  vita: ["вита", "vita"],
};

export function assistantAliases(): string[] {
  const name = ASSISTANT_NAME.toLowerCase();
  const configured = (process.env.NEXT_PUBLIC_HOLOVANT_ASSISTANT_ALIASES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  return [name, ...(BUILT_IN_ALIASES[name] ?? []), ...configured].filter(
    (v, i, all) => all.indexOf(v) === i,
  );
}
