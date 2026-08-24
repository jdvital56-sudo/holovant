"use client";

import type { ModuleDefinition, ModuleMetric } from "@holovant/module-contracts";
import { RadialGauge } from "./RadialGauge";

interface FaceProps {
  module: ModuleDefinition;
  metrics: ModuleMetric[];
  accent: string;
}

function code(label: string) {
  return label.slice(0, 2).toUpperCase();
}

function DeltaChip({ deltaPct, accent }: { deltaPct: number; accent: string }) {
  const up = deltaPct >= 0;
  return (
    <span
      className="rounded-full px-2 py-[3px] font-mono text-[13px] font-medium"
      style={{
        color: up ? accent : "var(--warn)",
        background: up ? `${accent}1f` : "rgba(255,138,61,0.12)",
      }}
    >
      {up ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

/**
 * How full a module's gauge reads. Derived from its own reported change rather
 * than invented, so the arc is showing something true about the module even
 * while the data behind it is still mock.
 */
function gaugeValue(metric: ModuleMetric | undefined): number {
  if (!metric?.deltaPct) return 0.62;
  return Math.max(0.12, Math.min(0.95, Math.abs(metric.deltaPct) / 8));
}

/** Reads like a measuring device: one figure, stated once, on a dial. */
export function InstrumentFace({ module, metrics, accent }: FaceProps) {
  const primary = metrics[0];
  const secondary = metrics[1];

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[15px] font-semibold tracking-[0.2em]" style={{ color: accent }}>
          {code(module.label)}
        </span>
        {primary?.deltaPct !== undefined && <DeltaChip deltaPct={primary.deltaPct} accent={accent} />}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <RadialGauge value={gaugeValue(primary)} accent={accent}>
          <span className="font-display text-[34px] font-semibold leading-none text-frost">
            {primary?.value ?? "—"}
          </span>
          <span className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-mist">
            {primary?.label ?? ""}
          </span>
        </RadialGauge>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="font-display text-[22px] font-semibold leading-tight text-frost">{module.label}</div>
        <div className="font-mono text-[14px] text-mist">
          {secondary ? `${secondary.label} ${secondary.value}` : module.tagline}
        </div>
      </div>
    </div>
  );
}

const GLYPHS: Record<string, string> = {
  instagram: "M4 4h16v16H4z M8 12a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0",
  tiktok: "M9 16a3 3 0 1 0 3-3V4c1 3 3 4 6 4",
  youtube: "M3 7h18v10H3z M10 9l5 3-5 3z",
  x: "M4 4l16 16 M20 4L4 20",
  linkedin: "M4 9v11 M4 5v0.5 M10 20v-6a3 3 0 0 1 6 0v6 M10 20v-11",
  telegram: "M3 12l18-7-6 16-4-6z",
  stocks: "M3 17l5-6 4 4 8-9",
  projects: "M3 7h6l2 3h10v9H3z",
  sports: "M12 3a9 9 0 1 0 0 18 a9 9 0 1 0 0-18 M3 12h18 M12 3c4 4 4 14 0 18 M12 3c-4 4-4 14 0 18",
  calendar: "M3 6h18v15H3z M3 11h18 M8 3v5 M16 3v5",
  weather: "M6 16a4 4 0 0 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7z",
  ai: "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M8 8h8v8H8z",
  news: "M3 5h14v15H3z M17 9h4v11H3 M6 9h8 M6 13h8 M6 17h5",
  music: "M9 18V6l10-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0",
  system: "M6 6h12v12H6z M9 3v3 M15 3v3 M9 18v3 M15 18v3 M3 9h3 M3 15h3 M18 9h3 M18 15h3",
};

/** Icon-led and quiet: one mark, the name, one number. */
export function GlyphFace({ module, metrics, accent }: FaceProps) {
  const primary = metrics[0];

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <svg
        viewBox="0 0 24 24"
        className="h-[74px] w-[74px]"
        fill="none"
        stroke={accent}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 10px ${accent}66)` }}
      >
        <path d={GLYPHS[module.id] ?? "M4 4h16v16H4z"} />
      </svg>

      <div className="mt-6 font-display text-[26px] font-semibold leading-tight text-frost">{module.label}</div>
      <div className="mt-1 font-mono text-[14px] uppercase tracking-[0.14em] text-mist">{module.tagline}</div>

      {primary && (
        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-[30px] font-semibold text-frost">{primary.value}</span>
          {primary.deltaPct !== undefined && <DeltaChip deltaPct={primary.deltaPct} accent={accent} />}
        </div>
      )}
    </div>
  );
}

/** Densest: a system panel, every row a labelled value. */
export function ReadoutFace({ module, metrics, accent }: FaceProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-display text-[22px] font-semibold text-frost">{module.label}</span>
        <span className="font-mono text-[14px] tracking-[0.2em]" style={{ color: accent }}>
          {code(module.label)}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {metrics.slice(0, 3).map((metric) => (
          <div key={metric.label}>
            <div className="font-mono text-[13px] uppercase tracking-[0.14em] text-mist">{metric.label}</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[24px] font-semibold leading-tight text-frost">
                {metric.value}
              </span>
              {metric.deltaPct !== undefined && <DeltaChip deltaPct={metric.deltaPct} accent={accent} />}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <span className="font-mono text-[13px] text-mist">{module.tagline}</span>
      </div>
    </div>
  );
}
