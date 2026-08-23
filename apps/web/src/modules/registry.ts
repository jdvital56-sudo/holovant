import type { ModuleDefinition } from "@holovant/module-contracts";
import { instagramModule } from "./instagram";
import { tiktokModule } from "./tiktok";
import { youtubeModule } from "./youtube";
import { xModule } from "./x";
import { linkedinModule } from "./linkedin";
import { telegramModule } from "./telegram";
import { stocksModule } from "./stocks";
import { projectsModule } from "./projects";
import { sportsModule } from "./sports";
import { calendarModule } from "./calendar";
import { weatherModule } from "./weather";
import { aiModule } from "./ai";
import { newsModule } from "./news";
import { musicModule } from "./music";
import { systemModule } from "./system";

/**
 * The single source of truth for which modules exist and in what orbit
 * order. Adding an 11th module means one new folder + one entry here —
 * orbit/camera/carousel code reads this array and never hardcodes a count.
 */
export const moduleRegistry: ModuleDefinition[] = [
  instagramModule,
  tiktokModule,
  youtubeModule,
  xModule,
  linkedinModule,
  telegramModule,
  stocksModule,
  projectsModule,
  sportsModule,
  calendarModule,
  weatherModule,
  aiModule,
  newsModule,
  musicModule,
  systemModule,
];
