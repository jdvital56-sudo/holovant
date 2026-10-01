import type { NextConfig } from "next";
import { securityHeaders } from "./src/server/securityHeaders";

const nextConfig: NextConfig = {
  // "X-Powered-By: Next.js" tells a stranger which framework, and so which
  // advisories, to try. The health endpoint already avoids naming versions.
  poweredByHeader: false,
  images: {
    // Nothing in this app uses next/image, but the optimiser endpoint at
    // /_next/image is served anyway, and the middleware only matches /api/*
    // — so the perimeter does not cover it. It has had two unauthenticated
    // RCEs of its own and it drags in sharp, which carries libvips and
    // libheif advisories this app has no use for. Turning it off removes the
    // endpoint and makes all of that moot.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
