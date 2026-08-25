import type { AdviceLang, ModuleAdvice } from "@holovant/module-contracts";
import type { ClientDiagnostics } from "./diagnostics";
import type { ServerHealth } from "@/app/api/health/route";

export interface SystemReport {
  client: ClientDiagnostics;
  server: ServerHealth | null;
  fps: number;
  qualityTier: string;
}

/** Below this the scene is not holding frame rate on this machine. */
const FPS_TROUBLE = 45;
const HEAP_PRESSURE_PCT = 70;
const BATTERY_LOW_PCT = 20;

/**
 * Turns the readings into a verdict.
 *
 * The point of a system check is to say whether anything is wrong and what to
 * do — a list of numbers leaves the user to diagnose their own machine, which
 * is the work they opened the module to avoid.
 */
export function systemAdvice(report: SystemReport, lang: AdviceLang): ModuleAdvice {
  const { client, server, fps, qualityTier } = report;
  const ru = lang === "ru";
  const tips: string[] = [];
  const problems: string[] = [];

  const missing = server?.services.filter((s) => s.state === "missing") ?? [];
  const failing = server?.services.filter((s) => s.state === "failing") ?? [];

  if (fps > 0 && fps < FPS_TROUBLE) {
    problems.push(
      ru
        ? `Кадров ${fps} — сцена не держит темп, качество снижено до ${qualityTier}`
        : `${fps} fps — the scene is not holding rate, quality dropped to ${qualityTier}`,
    );
  }

  const heapPct =
    client.jsHeapUsedMb && client.jsHeapLimitMb
      ? Math.round((client.jsHeapUsedMb / client.jsHeapLimitMb) * 100)
      : null;
  if (heapPct !== null && heapPct > HEAP_PRESSURE_PCT) {
    problems.push(
      ru
        ? `Память вкладки занята на ${heapPct}% — перезагрузите страницу`
        : `Tab memory ${heapPct}% used — reload the page`,
    );
  }

  if (client.batteryPct !== null && client.batteryPct < BATTERY_LOW_PCT && !client.batteryCharging) {
    problems.push(
      ru
        ? `Батарея ${client.batteryPct}% — под нагрузкой 3D сядет быстро`
        : `Battery ${client.batteryPct}% — 3D will drain it quickly`,
    );
  }

  for (const service of failing) {
    problems.push(
      ru ? `${service.label}: не отвечает` : `${service.label}: not responding`,
    );
  }

  // Hardware first: it is the thing the user cannot change by editing config.
  const hardware = [
    client.gpu ? (ru ? `Видео: ${client.gpu}` : `GPU: ${client.gpu}`) : null,
    client.cpuCores ? (ru ? `${client.cpuCores} ядер` : `${client.cpuCores} cores`) : null,
    client.deviceMemoryGb ? `${client.deviceMemoryGb} GB RAM` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (hardware) tips.push(hardware);

  tips.push(
    ru
      ? `${fps > 0 ? fps : "—"} кадров в секунду, качество ${qualityTier}${client.screen ? `, экран ${client.screen}` : ""}`
      : `${fps > 0 ? fps : "—"} fps at ${qualityTier} quality${client.screen ? `, screen ${client.screen}` : ""}`,
  );

  if (server) {
    const okCount = server.services.filter((s) => s.state === "ok").length;
    tips.push(
      ru
        ? `Сервисы: ${okCount} из ${server.services.length} на связи`
        : `Services: ${okCount} of ${server.services.length} connected`,
    );
    for (const service of missing) {
      tips.push(ru ? `${service.label} — не подключён` : `${service.label} — not connected`);
    }
  }

  if (client.networkType) {
    tips.push(
      ru
        ? `Сеть ${client.networkType}${client.downlinkMbps ? `, ${client.downlinkMbps} Мбит/с` : ""}`
        : `Network ${client.networkType}${client.downlinkMbps ? `, ${client.downlinkMbps} Mbps` : ""}`,
    );
  }

  tips.push(...problems);

  // Spoken: the verdict, not the inventory. Everything above is on screen.
  const spoken = problems.length
    ? ru
      ? `Нашёл ${problems.length === 1 ? "проблему" : "проблемы"}. ${problems[0]}`
      : `Found ${problems.length === 1 ? "a problem" : "problems"}. ${problems[0]}`
    : missing.length
      ? ru
        ? `Железо в порядке, ${fps} кадров. Не подключено: ${missing.map((s) => s.label).join(", ")}`
        : `Hardware is fine at ${fps} fps. Not connected: ${missing.map((s) => s.label).join(", ")}`
      : ru
        ? `Всё в порядке. ${fps} кадров, все сервисы на связи`
        : `All clear. ${fps} fps, every service connected`;

  return { spoken, tips };
}
