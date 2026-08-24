"use client";

import type { ModuleDefinition, ModuleMetric } from "@holovant/module-contracts";
import { HoloGauge } from "./HoloGauge";

interface HoloFaceProps {
  module: ModuleDefinition;
  metrics: ModuleMetric[];
  accent: string;
  accountCount: number;
}

/** Deterministic per module, so a card's waveform is its own and stays put. */
function waveform(id: string, points = 34): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 9973;
  return Array.from({ length: points }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  });
}

function gaugeValue(metric: ModuleMetric | undefined): number {
  if (!metric?.deltaPct) return 0.68;
  return Math.max(0.15, Math.min(0.95, Math.abs(metric.deltaPct) / 8));
}

/**
 * Projected-light treatment: the panel reads as a hologram rather than a solid
 * object, so it stays translucent, the ring carries almost all the brightness,
 * and the supporting readouts sit deliberately below legibility — present as
 * texture, the way instrument panels are in the reference.
 */
export function HoloFace({ module, metrics, accent, accountCount }: HoloFaceProps) {
  const primary = metrics[0];
  const secondary = metrics[1];
  const wave = waveform(module.id);

  return (
    <div className="flex h-full flex-col items-center justify-between">
      <div className="flex w-full items-center justify-between pt-1">
        <div className="flex items-center gap-[5px]">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="h-[5px] w-[5px] rounded-full"
              style={{
                background: i < 4 ? accent : "rgba(233,238,246,0.25)",
                boxShadow: i < 4 ? `0 0 6px ${accent}` : "none",
              }}
            />
          ))}
        </div>
        {/* The figure on a multi-account card is a combined one, and saying so
            on the face avoids it being read as a single profile's number. */}
        {accountCount > 1 && (
          <span className="font-mono text-[11px] tracking-[0.12em]" style={{ color: accent }}>
            ×{accountCount}
          </span>
        )}
      </div>

      <HoloGauge value={gaugeValue(primary)} accent={accent}>
        <span
          className="font-display text-[42px] font-bold leading-none tracking-tight text-white"
          style={{ textShadow: `0 0 18px ${accent}cc, 0 0 40px ${accent}66` }}
        >
          {primary?.value ?? "—"}
        </span>
        <span className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-frost/70">
          {primary?.label ?? ""}
        </span>
      </HoloGauge>

      <div className="w-full">
        <div className="mb-2 flex items-end justify-center gap-[2px] px-2 opacity-70">
          {wave.map((v, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full"
              style={{ height: `${3 + v * 15}px`, background: accent, opacity: 0.35 + v * 0.5 }}
            />
          ))}
        </div>

        <div
          className="mb-2 h-px w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }}
        />

        <div className="text-center">
          <div
            className="font-display text-[21px] font-semibold leading-tight text-white"
            style={{ textShadow: `0 0 14px ${accent}80` }}
          >
            {module.label}
          </div>
          <div className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.12em] text-frost/55">
            {secondary ? `${secondary.label} · ${secondary.value}` : module.tagline}
          </div>
        </div>
      </div>
    </div>
  );
}
