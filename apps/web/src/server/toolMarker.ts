/**
 * Sent once down the answer stream when the model reaches for a tool, so the
 * client can fill the wait with a word instead of silence. Checking the web
 * takes seconds, and until now those seconds looked like the system had
 * stopped rather than like it was working.
 *
 * Written as an escape, never as the character itself: a literal control byte
 * in source is the mistake `sourceHygiene.test.ts` exists to catch.
 */
export const TOOL_MARKER = String.fromCharCode(1);
