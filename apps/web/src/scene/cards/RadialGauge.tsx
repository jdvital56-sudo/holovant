"use client";

interface RadialGaugeProps {
  /** 0..1 fill of the arc. */
  value: number;
  accent: string;
  size?: number;
  /** Rendered inside the ring — the number the gauge is about. */
  children?: React.ReactNode;
}

const STROKE = 7;
/** Leaves a gap at the bottom so the arc reads as a gauge, not a full circle. */
const SWEEP_DEG = 280;

/**
 * A single arc carrying one number. Replaces the bar strip, which ran together
 * into one continuous band across neighbouring cards and read as noise rather
 * than as each card's own figure.
 */
export function RadialGauge({ value, accent, size = 132, children }: RadialGaugeProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * (SWEEP_DEG / 360);
  const filled = arc * Math.max(0, Math.min(1, value));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        // Rotated so the gap sits at the bottom and the arc starts lower-left.
        style={{ transform: `rotate(${90 + (360 - SWEEP_DEG) / 2}deg)` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={STROKE}
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={STROKE}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${accent}aa)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
