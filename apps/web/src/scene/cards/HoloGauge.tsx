"use client";

interface HoloGaugeProps {
  /** 0..1 fill of the bright inner arc. */
  value: number;
  accent: string;
  size?: number;
  children?: React.ReactNode;
}

const TICK_COUNT = 72;
/** Leaves a gap top and bottom so the rings read as instrument arcs. */
const SWEEP_DEG = 300;
const SEGMENTS = 26;

/**
 * The layered ring from the chosen reference: a fine tick scale on the
 * outside, a coarse segmented arc inside it, and one bright continuous arc
 * carrying the actual value. Three scales at three densities is what makes it
 * read as an instrument rather than a progress bar bent into a circle.
 */
export function HoloGauge({ value, accent, size = 190, children }: HoloGaugeProps) {
  const c = size / 2;
  const clamped = Math.max(0, Math.min(1, value));

  const tickOuter = c - 4;
  const tickInner = c - 13;
  const segRadius = c - 24;
  const arcRadius = c - 42;

  const segCircumference = 2 * Math.PI * segRadius;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const segArc = segCircumference * (SWEEP_DEG / 360);
  const mainArc = arcCircumference * (SWEEP_DEG / 360);

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const frac = i / TICK_COUNT;
    const deg = -SWEEP_DEG / 2 + frac * SWEEP_DEG;
    const rad = ((deg - 90) * Math.PI) / 180;
    const major = i % 6 === 0;
    const inner = major ? tickInner : tickInner + 4;
    return {
      x1: c + Math.cos(rad) * inner,
      y1: c + Math.sin(rad) * inner,
      x2: c + Math.cos(rad) * tickOuter,
      y2: c + Math.sin(rad) * tickOuter,
      lit: frac <= clamped,
      major,
    };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.lit ? accent : "rgba(233,238,246,0.22)"}
            strokeWidth={t.major ? 1.6 : 1}
            opacity={t.lit ? 0.95 : 0.5}
          />
        ))}

        {/* Coarse segmented ring: the middle of the three scales. */}
        <circle
          cx={c}
          cy={c}
          r={segRadius}
          fill="none"
          stroke={accent}
          strokeWidth={7}
          opacity={0.55}
          strokeDasharray={`${(segArc / SEGMENTS) * 0.55} ${(segArc / SEGMENTS) * 0.45}`}
          transform={`rotate(${-90 - SWEEP_DEG / 2} ${c} ${c})`}
        />

        {/* The value itself: one bright continuous arc with heavy bloom. */}
        <circle
          cx={c}
          cy={c}
          r={arcRadius}
          fill="none"
          stroke="rgba(233,238,246,0.14)"
          strokeWidth={9}
          strokeDasharray={`${mainArc} ${arcCircumference}`}
          strokeLinecap="round"
          transform={`rotate(${-90 - SWEEP_DEG / 2} ${c} ${c})`}
        />
        <circle
          cx={c}
          cy={c}
          r={arcRadius}
          fill="none"
          stroke={accent}
          strokeWidth={9}
          strokeDasharray={`${mainArc * clamped} ${arcCircumference}`}
          strokeLinecap="round"
          transform={`rotate(${-90 - SWEEP_DEG / 2} ${c} ${c})`}
          style={{ filter: `drop-shadow(0 0 10px ${accent}) drop-shadow(0 0 22px ${accent}99)` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
