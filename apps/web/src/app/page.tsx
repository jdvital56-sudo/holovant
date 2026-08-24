import { SceneRoot } from "@/scene/core/SceneRoot";
import { HUD } from "@/hud/HUD";
import { ModulePanel } from "@/hud/ModulePanel";
import { SearchResults } from "@/hud/SearchResults";

export default function Home() {
  return (
    <main className="relative w-screen h-screen bg-void overflow-hidden">
      <SceneRoot />
      <HUD />
      <ModulePanel />
      <SearchResults />
      <div className="fixed top-4 sm:top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
        <div className="text-xs tracking-[0.3em] font-semibold text-frost">HOLOVANT</div>
      </div>
      <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center font-mono text-[9px] tracking-wider text-mist/70">
        DRAG TO ROTATE &middot; CLICK THE FRONT CARD TO OPEN IT &middot; ARROW KEYS ALSO WORK
      </div>
    </main>
  );
}
