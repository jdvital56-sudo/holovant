import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsWeather } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";

/**
 * Real weather, for the city he last said he was in.
 *
 * It used to read 21° and clear, always, to everyone — a made-up number a
 * person would dress by. Now every state it can be in has its own words, and
 * none of the unknown ones has a number: not knowing where he is and not being
 * able to reach the forecast are different things, and both are different from
 * a mild day.
 */
export type WeatherSnapshot = CardsWeather;

const UNKNOWN = "—";

const SKY_RU: Record<NonNullable<WeatherSnapshot["condition"]>, string> = {
  clear: "ясно",
  clouds: "облачно",
  rain: "дождь",
  fog: "туман",
};

export const weatherModule: ModuleDefinition<WeatherSnapshot> = {
  id: "weather",
  label: "Weather",
  tagline: "Current conditions",
  themeColor: "#57bfe1",
  dataProvider: createCardProvider<WeatherSnapshot>("weather", {
    state: "unreachable",
    place: null,
    temperatureC: null,
    high: null,
    low: null,
    condition: null,
  }),
  toMetrics: (d) => {
    if (d.state === "no-place") {
      return [
        { label: "Город", value: "не указан — скажите, где вы" },
        { label: "Температура", value: UNKNOWN },
      ];
    }
    if (d.state === "unreachable") {
      return [
        { label: "Город", value: d.place ?? UNKNOWN },
        { label: "Температура", value: "не удалось получить" },
      ];
    }
    return [
      { label: "Город", value: d.place ?? UNKNOWN },
      { label: "Температура", value: `${d.temperatureC}°C` },
      { label: "Небо", value: d.condition ? SKY_RU[d.condition] : UNKNOWN },
      { label: "Сегодня", value: `от ${d.low}°C до ${d.high}°C` },
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state !== "ok" || d.temperatureC === null) {
      const tips =
        lang === "ru"
          ? d.state === "no-place"
            ? ["Не знаю ваш город", "Скажите, где вы, и погода появится здесь сама"]
            : ["Погоду сейчас не достать", "Прогноз не отвечает — попробуйте позже"]
          : d.state === "no-place"
            ? ["I do not know your city", "Say where you are and this fills itself in"]
            : ["The forecast is not answering", "Try again shortly"];
      return { spoken: tips[0], tips };
    }

    const cold = d.temperatureC <= 8;
    const hot = d.temperatureC >= 30;
    const wet = d.condition === "rain";
    const tips =
      lang === "ru"
        ? [
            `${d.place}: ${d.temperatureC}°, ${d.condition ? SKY_RU[d.condition] : ""}`.trim(),
            cold ? "Холодно — куртка обязательна" : hot ? "Жарко — держитесь тени и пейте воду" : "Тепло, можно налегке",
            wet ? "Возьмите зонт" : "Осадков не ожидается",
          ]
        : [
            `${d.place}: ${d.temperatureC}°, ${d.condition ?? ""}`.trim(),
            cold ? "Cold — take a coat" : hot ? "Hot — keep to the shade and drink water" : "Mild, travel light",
            wet ? "Take an umbrella" : "No precipitation expected",
          ];
    return { spoken: `${tips[0]}. ${tips[1]}`, tips };
  },
};
