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
  themeColor: "#57bfe1",
  dataProvider: createMockProvider<WeatherSnapshot>({
    condition: "clear",
    temperatureC: 21,
  }),
  toMetrics: (d) => [
    { label: "Temperature", value: `${d.temperatureC}°C` },
    { label: "Condition", value: d.condition },
  ],
  toAdvice: (d, lang) => {
    const cold = d.temperatureC <= 8;
    const wet = d.condition === "rain";
    const skyRu =
      d.condition === "clear" ? "ясно" : d.condition === "rain" ? "дождь" : d.condition === "fog" ? "туман" : "облачно";
    const tips =
      lang === "ru"
        ? [
            `${d.temperatureC}°, ${skyRu}`,
            cold ? "Холодно — куртка обязательна" : "Тепло, можно налегке",
            wet ? "Возьмите зонт" : "Осадков не ожидается",
          ]
        : [
            `${d.temperatureC}°, ${d.condition}`,
            cold ? "Cold — take a coat" : "Mild, travel light",
            wet ? "Take an umbrella" : "No precipitation expected",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
