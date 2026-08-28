import { NextResponse } from "next/server";
import os from "node:os";
import { isPiperConfigured } from "@/server/piperVoice";
import { isLlmConfigured } from "@/server/llm";

export const runtime = "nodejs";

export interface ServiceHealth {
  id: "voice" | "assistant" | "search" | "music" | "weather";
  label: string;
  /** `ok` means reachable, not merely configured — the difference matters. */
  state: "ok" | "missing" | "failing";
  detail: string;
}

export interface ServerHealth {
  services: ServiceHealth[];
  host: {
    platform: string;
    cpuCount: number;
    loadPct: number | null;
    memoryUsedPct: number;
    uptimeHours: number;
  };
}

/** A health check that hangs is itself a failure, so each probe is capped. */
const PROBE_TIMEOUT_MS = 4000;

/** The System module polls this. Without a cache every poll is an outbound
 *  request, which is both latency the user waits on and, once deployed, a way
 *  to have the server generate traffic on someone's behalf. */
const PROBE_CACHE_MS = 30_000;
let weatherProbe: { at: number; result: ServiceHealth } | null = null;

async function probeWeather(): Promise<ServiceHealth> {
  if (weatherProbe && Date.now() - weatherProbe.at < PROBE_CACHE_MS) {
    return weatherProbe.result;
  }
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=temperature_2m",
      { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) },
    );
    const result: ServiceHealth = response.ok
      ? { id: "weather", label: "Weather", state: "ok", detail: "Open-Meteo responding" }
      : { id: "weather", label: "Weather", state: "failing", detail: `HTTP ${response.status}` };
    weatherProbe = { at: Date.now(), result };
    return result;
  } catch {
    const result: ServiceHealth = {
      id: "weather",
      label: "Weather",
      state: "failing",
      detail: "Not reachable",
    };
    weatherProbe = { at: Date.now(), result };
    return result;
  }
}

function memoryUsedPct(): number {
  const total = os.totalmem();
  if (!total) return 0;
  return Math.round(((total - os.freemem()) / total) * 100);
}

/**
 * Load average is a Unix idea; Windows reports zeros for it rather than
 * failing, which would otherwise be shown as a genuine 0% load.
 */
function loadPct(): number | null {
  const [oneMinute] = os.loadavg();
  if (!oneMinute) return null;
  return Math.min(100, Math.round((oneMinute / Math.max(1, os.cpus().length)) * 100));
}

export async function GET() {
  const services: ServiceHealth[] = [
    isPiperConfigured()
      ? { id: "voice", label: "Voice", state: "ok", detail: "Piper configured" }
      : {
          id: "voice",
          label: "Voice",
          state: "missing",
          detail: "Using the browser voice — set HOLOVANT_PIPER_* for the product voice",
        },
    isLlmConfigured()
      ? { id: "assistant", label: "Assistant", state: "ok", detail: "Model configured" }
      : {
          id: "assistant",
          label: "Assistant",
          state: "missing",
          detail: "No key — questions cannot be answered",
        },
    process.env.FIRECRAWL_API_KEY
      ? { id: "search", label: "Web search", state: "ok", detail: "Key present" }
      : { id: "search", label: "Web search", state: "missing", detail: "No key — search is off" },
    // Not merely cosmetic: without a key the lookup falls back to reading
    // YouTube's results page, which works but is against their terms. Showing
    // which path is live is the difference between knowing and assuming.
    process.env.YOUTUBE_API_KEY
      ? { id: "music", label: "Music", state: "ok", detail: "YouTube Data API" }
      : {
          id: "music",
          label: "Music",
          state: "missing",
          detail: "No key — falling back to page scraping",
        },
    await probeWeather(),
  ];

  const health: ServerHealth = {
    services,
    host: {
      // The OS family without its exact release: the System module shows the
      // user which machine they are on, and a patch level tells a stranger
      // which vulnerabilities to try.
      platform: os.type(),
      cpuCount: os.cpus().length,
      loadPct: loadPct(),
      memoryUsedPct: memoryUsedPct(),
      uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    },
  };

  return NextResponse.json(health);
}
