/**
 * Shown while the renderer chunk streams in. The brief wants opening the app
 * to feel like booting a system, so the wait states what it is doing rather
 * than showing a spinner.
 */
export function BootIndicator() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-void" translate="no">
      <div className="text-center font-mono">
        <div className="mx-auto h-px w-40 overflow-hidden bg-white/10">
          <div className="h-full w-1/3 animate-[boot-sweep_1.4s_ease-in-out_infinite] bg-signal" />
        </div>
        <div className="mt-4 text-[10px] tracking-[0.3em] text-mist">INITIALISING RENDERER</div>
      </div>
    </div>
  );
}
