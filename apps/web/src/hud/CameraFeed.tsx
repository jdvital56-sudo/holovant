"use client";

import type { RefObject } from "react";

interface CameraFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Hosts the camera video element for the tracking engine without showing it.
 *
 * The element has to stay mounted and playing — browsers may never decode
 * frames for a detached video, and `display: none` / `visibility: hidden` can
 * stop decoding too, which silently kills detection. It therefore keeps real
 * dimensions (a collapsed box risks the same treatment) and is hidden by being
 * fully transparent and stacked behind the scene, so it emits no light.
 */
export function CameraFeed({ videoRef }: CameraFeedProps) {
  return (
    <video
      ref={videoRef}
      aria-hidden
      tabIndex={-1}
      playsInline
      muted
      className="pointer-events-none fixed bottom-0 right-0 -z-10 opacity-0"
      // Inline so the box cannot collapse: Tailwind's preflight gives video a
      // max-width/height:auto rule that wins over a generated width utility,
      // and a zero-width video risks being skipped by frame decoding.
      style={{ width: 160, height: 120, maxWidth: "none" }}
    />
  );
}
