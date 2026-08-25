import { create } from "zustand";
import type { ServerHealth } from "@/app/api/health/route";
import { useQualityStore } from "@/quality/qualityStore";
import { collectDiagnostics } from "./diagnostics";
import type { SystemReport } from "./report";

interface SystemState {
  status: "idle" | "checking" | "ready";
  report: SystemReport | null;
}

export const useSystemStore = create<SystemState>(() => ({ status: "idle", report: null }));

/** A check that hangs is worse than one that reports the server unreachable. */
const HEALTH_TIMEOUT_MS = 8000;

/**
 * Runs the actual check. The client half measures this machine; the server
 * half reports which integrations are configured and answering, which is the
 * part a list of hardware specs would miss entirely.
 */
export async function runSystemCheck(): Promise<SystemReport> {
  useSystemStore.setState({ status: "checking" });

  const client = await collectDiagnostics();

  let server: ServerHealth | null = null;
  try {
    const response = await fetch("/api/health", { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (response.ok) server = (await response.json()) as ServerHealth;
  } catch {
    // Left null: the report says the server could not be reached rather than
    // claiming its services are fine.
  }

  const { fps, tier } = useQualityStore.getState();
  const report: SystemReport = { client, server, fps, qualityTier: tier };
  useSystemStore.setState({ status: "ready", report });
  return report;
}
