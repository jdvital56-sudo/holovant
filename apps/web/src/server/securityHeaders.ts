/**
 * The headers every page is served with.
 *
 * There were none. The page asks for the microphone and the camera and can
 * open third-party sites, and nothing told the browser where scripts may come
 * from, who may frame the page, or which devices it may use.
 *
 * The policy is written from what the app actually loads, found in the code,
 * because a policy written from what it ought to load switches features off
 * without a word: the browser refuses the request and nothing on screen says
 * so. Each external host below is here for a named reason; the test holds both
 * that they are allowed and that nothing else is.
 *
 * Scripts keep 'unsafe-inline' because Next injects inline scripts to hydrate
 * the page, and 'wasm-unsafe-eval' because hand tracking runs as WebAssembly.
 * The strictness that matters here is elsewhere: no framing, no plugins, no
 * foreign base URL, and scripts from one CDN only.
 */

/** Hand tracking: MediaPipe's WebAssembly runtime. */
const MEDIAPIPE_RUNTIME = "https://cdn.jsdelivr.net";
/** Hand tracking: the hand-landmark model file. */
const MEDIAPIPE_MODEL = "https://storage.googleapis.com";
/** Music: the player is an embedded YouTube frame, privacy-enhanced domain. */
const YOUTUBE_PLAYER = "https://www.youtube-nocookie.com";
/** The interface fonts, Sora and JetBrains Mono: the stylesheet's host. */
const FONT_STYLESHEETS = "https://fonts.googleapis.com";
/** ...and the host the font files themselves are served from. */
const FONT_FILES = "https://fonts.gstatic.com";

export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${MEDIAPIPE_RUNTIME}`,
    // Tailwind and the animation library both write inline styles.
    `style-src 'self' 'unsafe-inline' ${FONT_STYLESHEETS}`,
    // Synthesised speech arrives as a blob and is played from an object URL.
    "media-src 'self' blob:",
    "img-src 'self' data: blob: https://i.ytimg.com",
    `font-src 'self' data: ${FONT_FILES}`,
    `connect-src 'self' ${MEDIAPIPE_RUNTIME} ${MEDIAPIPE_MODEL}`,
    // MediaPipe may run its work in a worker built from a blob.
    "worker-src 'self' blob:",
    `frame-src ${YOUTUBE_PLAYER}`,
    // Nobody may put this page inside a frame of their own: that is how a
    // click on something harmless becomes a click on "allow microphone".
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // For browsers too old to read frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    // The page itself may use the microphone and camera; nothing it frames may.
    { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=()" },
  ];
}
