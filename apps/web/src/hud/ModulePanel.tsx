"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ModuleDefinition, ModuleMetric } from "@holovant/module-contracts";
import { useOrbitStore } from "@/stores/orbitStore";
import { moduleRegistry } from "@/modules/registry";

function useModuleMetrics(activeModule: ModuleDefinition | undefined) {
  const [metrics, setMetrics] = useState<ModuleMetric[]>([]);

  useEffect(() => {
    if (!activeModule) return;
    let active = true;
    // getSnapshot may be sync (mock) or async (live, Phase 3) — Promise.resolve
    // normalizes both so swapping in a real provider needs no change here.
    Promise.resolve(activeModule.dataProvider.getSnapshot()).then((data) => {
      if (active) setMetrics(activeModule.toMetrics(data));
    });
    return () => {
      active = false;
    };
  }, [activeModule]);

  // Stale metrics from a previously opened module are never shown: the panel
  // only renders while activeModule is set, and each open refreshes them.
  return activeModule ? metrics : [];
}

export function ModulePanel() {
  const expandedId = useOrbitStore((s) => s.expandedId);
  const dispatch = useOrbitStore((s) => s.dispatch);
  const activeModule = moduleRegistry.find((m) => m.id === expandedId);
  const metrics = useModuleMetrics(activeModule);

  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "collapse", source: "keyboard" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedId, dispatch]);

  return (
    <AnimatePresence>
      {activeModule && (
        <motion.div
          key={activeModule.id}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="pointer-events-auto fixed left-1/2 top-1/2 z-20 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[rgba(143,178,222,0.22)] bg-[rgba(10,16,26,0.82)] p-6 backdrop-blur-xl"
          style={{ boxShadow: `0 20px 80px rgba(0,0,0,0.6), 0 0 60px ${activeModule.themeColor}33` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: activeModule.themeColor }}
              >
                {activeModule.id}
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-frost">{activeModule.label}</h2>
              <p className="font-mono text-[11px] text-mist">{activeModule.tagline}</p>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "collapse", source: "mouse" })}
              aria-label="Close module"
              className="rounded-full border border-[rgba(143,178,222,0.22)] px-3 py-1 font-mono text-[11px] text-mist transition-colors hover:border-signal/60 hover:text-frost"
            >
              ESC
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2 last:border-0"
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-mist">{metric.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-frost">{metric.value}</span>
                  {metric.deltaPct !== undefined && (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: metric.deltaPct >= 0 ? activeModule.themeColor : "var(--warn)" }}
                    >
                      {metric.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(metric.deltaPct).toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[10px] leading-relaxed text-mist/70">
            Sample data — live {activeModule.label} connection arrives with the integrations phase.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
