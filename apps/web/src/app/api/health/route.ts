import { NextResponse } from "next/server";
import os from "node:os";
import { isPiperConfigured } from "@/server/piperVoice";
import { isLlmConfigured, llmConfig } from "@/server/llm";

export const runtime = "nodejs";

export interface ServiceHealth {
  id: "voice" | "assistant" | "search" | "weather";
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

async function probeWeather(): Promise<ServiceHealth> {
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=temperature_2m",
      { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) },
    );
    return response.ok
      ? { id: "weather", label: "Weather", state: "ok", detail: "Open-Meteo responding" }
      : { id: "weather", label: "Weather", state: "failing", detail: `HTTP ${response.status}` };
  } catch {
    return { id: "weather", label: "Weather", state: "failing", detail: "Not reachable" };
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
      ? { id: "assistant", label: "Assistant", state: "ok", detail: `Model ${llmConfig().model}` }
      : {
          id: "assistant",
          label: "Assistant",
          state: "missing",
          detail: "No key — questions cannot be answered",
        },
    process.env.FIRECRAWL_API_KEY
      ? { id: "search", label: "Web search", state: "ok", detail: "Key present" }
      : { id: "search", label: "Web search", state: "missing", detail: "No key — search is off" },
    await probeWeather(),
  ];

  const health: ServerHealth = {
    services,
    host: {
      platform: `${os.type()} ${os.release()}`,
      cpuCount: os.cpus().length,
      loadPct: loadPct(),
      memoryUsedPct: memoryUsedPct(),
      uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    },
  };

  return NextResponse.json(health);
}
