import { moduleRegistry } from "@/modules/registry";

/** Rendered when WebGL is unavailable — the app must never show a blank page. */
export function StaticFallbackScene() {
  return (
    <div className="fixed inset-0 bg-void overflow-y-auto p-6">
      <p className="font-mono text-[11px] text-mist mb-6">
        3D rendering unavailable on this device — showing module list.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl">
        {moduleRegistry.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-[rgba(143,178,222,0.16)] bg-[rgba(16,24,38,0.5)] p-4"
          >
            <div className="font-mono text-[10px] text-signal/85">{m.label.slice(0, 2).toUpperCase()}</div>
            <div className="text-sm font-semibold text-frost mt-1">{m.label}</div>
            <div className="font-mono text-[10px] text-mist mt-1">{m.tagline}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
