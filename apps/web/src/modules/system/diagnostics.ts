"use client";

export interface ClientDiagnostics {
  gpu: string | null;
  cpuCores: number | null;
  /** Gigabytes, and coarse: browsers round this to avoid fingerprinting. */
  deviceMemoryGb: number | null;
  jsHeapUsedMb: number | null;
  jsHeapLimitMb: number | null;
  networkType: string | null;
  downlinkMbps: number | null;
  batteryPct: number | null;
  batteryCharging: boolean | null;
  storageUsedPct: number | null;
  screen: string;
}

interface NavigatorWithExtras extends Navigator {
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
}

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

/**
 * Reduces a driver string to the name of the chip.
 *
 * Chrome reports "ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11
 * vs_5_0 ps_5_0, D3D11)" — the renderer is the middle field and the rest is
 * backend detail. Stripping bracketed text generically does not work here,
 * because the brackets nest: it drops the vendor and leaves a stray one behind.
 */
export function readableGpuName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();

  const angle = text.match(/^ANGLE\s*\((.*)\)$/i);
  if (angle) {
    const parts = angle[1].split(",");
    if (parts.length >= 2) text = parts[1].trim();
  }

  return (
    text
      .replace(/\((?:R|TM|C)\)/gi, "") // Intel(R), NVIDIA(TM)
      .replace(/\s*\(0x[0-9a-f]+\)/gi, "") // device ids
      .replace(/\s+(Direct3D\d+|OpenGL|Vulkan|D3D\d+)\b.*$/i, "")
      .replace(/\s+vs_\d+_\d+.*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim() || null
  );
}

/**
 * Reads the actual GPU rather than the generic string WebGL reports by
 * default. Without the debug extension every machine claims to be running on
 * a nondescript renderer, which tells the user nothing about their own.
 */
function readGpu(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return null;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = debugInfo
      ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
      : (gl.getParameter(gl.RENDERER) as string);
    return readableGpuName(raw);
  } catch {
    return null;
  }
}

const BYTES_PER_MB = 1024 * 1024;

/**
 * Everything measurable about the machine from inside a browser. Several of
 * these are absent outside Chrome, so each is optional rather than assumed —
 * a missing reading is reported as unknown, never as zero.
 */
export async function collectDiagnostics(): Promise<ClientDiagnostics> {
  const nav = navigator as NavigatorWithExtras;
  const perf = performance as PerformanceWithMemory;

  let batteryPct: number | null = null;
  let batteryCharging: boolean | null = null;
  try {
    const battery = await nav.getBattery?.();
    if (battery) {
      batteryPct = Math.round(battery.level * 100);
      batteryCharging = battery.charging;
    }
  } catch {
    // Desktops without a battery reject rather than resolve; not an error.
  }

  let storageUsedPct: number | null = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage && estimate.quota) {
      storageUsedPct = Math.round((estimate.usage / estimate.quota) * 100);
    }
  } catch {
    // Storage estimates are unavailable in private windows.
  }

  return {
    gpu: readGpu(),
    cpuCores: nav.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    jsHeapUsedMb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / BYTES_PER_MB) : null,
    jsHeapLimitMb: perf.memory ? Math.round(perf.memory.jsHeapSizeLimit / BYTES_PER_MB) : null,
    networkType: nav.connection?.effectiveType ?? null,
    downlinkMbps: nav.connection?.downlink ?? null,
    batteryPct,
    batteryCharging,
    storageUsedPct,
    screen: `${window.screen.width}×${window.screen.height}`,
  };
}
