/**
 * Whether something the model wants to remember about him is something he said.
 *
 * Found in the security re-test. Remembering a fact, setting his city and
 * choosing his news topics all ran the moment the model asked, and the only
 * thing stopping a calendar invite or a search result phrased in the first
 * person — "кстати, я решил переехать в Стамбул" — from being written into
 * his memory file was a sentence in the instructions asking the model not to.
 * A planted fact is then read back into every answer, and he never sees it
 * happen. Opening a website already had a guarantee that held even if the
 * model was taken in completely; these four writes had none.
 *
 * This is that guarantee: a write goes through only if its words are, for the
 * most part, words he used himself in this conversation. The model may
 * paraphrase — "живёт в Аланье" for "я в Аланье" — so words are compared by
 * their first letters, the way Russian endings vary. What it cannot do is
 * write down something he never said.
 */

/** Words that say who, not what. Every fact the model writes contains one. */
const GENERIC = new Set([
  "пользователь",
  "пользователя",
  "пользователю",
  "user",
  "users",
  "the",
  "and",
  "that",
  "his",
  "her",
  "they",
  "their",
  "очень",
  "сейчас",
  "теперь",
]);

/** Enough of a Russian word to survive the endings changing. */
const STEM = 4;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC.has(w));
}

const stem = (w: string) => w.slice(0, STEM);

/** Below this share of his own words, a claim did not come from him. */
export const GROUNDED_SHARE = 0.5;

/**
 * @param claim what the model wants to write
 * @param userSaid everything he said in this conversation, joined
 */
export function isGroundedIn(claim: string, userSaid: string): boolean {
  const claimed = words(claim);
  if (!claimed.length) return false;
  const his = new Set(words(userSaid).map(stem));
  const found = claimed.filter((w) => his.has(stem(w))).length;
  return found / claimed.length >= GROUNDED_SHARE;
}
