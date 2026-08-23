"use client";

import { useEffect, useState } from "react";
import { useOrbitStore } from "@/stores/orbitStore";
import { moduleRegistry } from "@/modules/registry";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function HUD() {
  const now = useClock();
  const selectedId = useOrbitStore((s) => s.selectedId);
  const selectedModule = moduleRegistry.find((m) => m.id === selectedId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none p-4 sm:p-8 grid grid-cols-2 grid-rows-[auto_1fr_auto] font-mono">
      <div className="pointer-events-auto col-start-1 row-start-1 justify-self-start">
        <div className="flex items-center gap-2 text-xs text-frost">
          <span className="w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(111,179,255,0.6)] animate-pulse" />
          SYSTEM ONLINE
        </div>
        <div className="text-[11px] text-mist mt-1">
          60 <span className="text-frost">FPS</span> &nbsp;&middot;&nbsp; GPU <span className="text-frost">NOMINAL</span>
        </div>
        <div className="text-[11px] text-mist">
          TRACKING &mdash; <span className="text-frost">OFF</span>
        </div>
      </div>

      <div className="pointer-events-auto col-start-2 row-start-1 justify-self-end text-right">
        <div className="text-2xl sm:text-3xl text-frost tabular-nums">
          {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : "--:--:--"}
        </div>
        <div className="text-[11px] text-mist mt-1.5 tracking-wider">
          {now ? `${pad(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}` : ""}
        </div>
      </div>

      <div className="pointer-events-auto col-start-1 row-start-3 self-end justify-self-start max-w-xs">
        <div className="text-[10px] tracking-widest uppercase text-mist mb-2">System log</div>
        <div className="text-[11px] text-mist leading-relaxed space-y-0.5">
          <div>&gt; holovant.core initialized</div>
          <div>&gt; module registry &mdash; {moduleRegistry.length} loaded</div>
          {selectedModule ? (
            <div className="text-frost">&gt; module: {selectedModule.id} selected</div>
          ) : (
            <div>&gt; awaiting selection</div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto col-start-2 row-start-3 self-end justify-self-end text-right">
        <div className="text-[10px] tracking-widest uppercase text-mist mb-2">Gesture</div>
        <div className="text-[13px] text-frost">&mdash; idle</div>
        <div className="w-[140px] h-[3px] bg-white/10 my-2 rounded-full overflow-hidden ml-auto">
          <div className="h-full bg-signal-dim w-0" />
        </div>
        <div className="text-[10px] text-mist tracking-wide">MOUSE FALLBACK ACTIVE</div>
      </div>
    </div>
  );
}
