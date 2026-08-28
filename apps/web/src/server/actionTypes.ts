/**
 * The things the assistant can do, as opposed to the things it can look up.
 *
 * A tool that searches the web runs on the server and returns text. A tool that
 * opens a module or starts a track has to run in the browser, where the
 * interface is. So the server does not perform these: it decides on them, and
 * sends them down the answer stream in an envelope the client unpacks and
 * carries out.
 *
 * Shared by both sides, and deliberately free of any import from either.
 */

export type ActionName =
  | "open_module"
  | "play_music"
  | "pause_music"
  | "resume_music"
  | "open_site"
  | "set_volume"
  | "save_track"
  | "play_collection"
  | "show_face"
  | "hide_face";

export interface QueuedAction {
  action: ActionName;
  args: Record<string, string>;
}

/**
 * Envelope markers. Control characters, so they can never collide with
 * anything the model writes and are unmistakable if a client fails to strip
 * them. Written as escapes — a literal control byte in source is the mistake
 * `sourceHygiene.test.ts` exists to catch.
 */
const OPEN = String.fromCharCode(2);
const CLOSE = String.fromCharCode(3);

export function encodeAction(action: QueuedAction): string {
  return `${OPEN}${JSON.stringify(action)}${CLOSE}`;
}

export interface ExtractedActions {
  /** The text with every envelope removed, safe to show and to speak. */
  text: string;
  actions: QueuedAction[];
  /**
   * An envelope the stream split in half. The caller prepends this to the next
   * chunk: acting on half an instruction is worse than acting a moment late.
   */
  pending: string;
}

/** Pulls every complete envelope out of a chunk of the stream. */
export function extractActions(chunk: string): ExtractedActions {
  const actions: QueuedAction[] = [];
  let text = "";
  let rest = chunk;

  for (;;) {
    const start = rest.indexOf(OPEN);
    if (start === -1) {
      text += rest;
      return { text, actions, pending: "" };
    }

    text += rest.slice(0, start);
    const end = rest.indexOf(CLOSE, start);
    if (end === -1) return { text, actions, pending: rest.slice(start) };

    try {
      const parsed = JSON.parse(rest.slice(start + 1, end)) as QueuedAction;
      if (parsed && typeof parsed.action === "string") actions.push(parsed);
    } catch {
      // A malformed envelope is dropped rather than guessed at.
    }
    rest = rest.slice(end + 1);
  }
}

/** Only ordinary web addresses are ever opened. */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
