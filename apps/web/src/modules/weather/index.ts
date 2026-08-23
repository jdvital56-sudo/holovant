import type { ModuleDefinition } from "@holovant/module-contracts";
import { createMockProvider } from "@/lib/createMockProvider";

export interface WeatherSnapshot {
  condition: "clear" | "clouds" | "rain" | "fog";
  temperatureC: number;
}

export const weatherModule: ModuleDefinition<WeatherSnapshot> = {
  id: "weather",
  label: "Weather",
  tagline: "Current conditions",
  themeColor: "#8b7bff",
  dataProvider: createMockProvider<WeatherSnapshot>({
    condition: "clear",
    temperatureC: 21,
  }),
};
