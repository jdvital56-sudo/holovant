import type { WeatherNow } from "@/app/api/weather/route";

/** WMO weather codes, grouped to the distinctions that change what you do. */
export type Sky = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export function skyFor(code: number): Sky {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloudy";
}

const SKY_LABEL: Record<Sky, { ru: string; en: string }> = {
  clear: { ru: "ясно", en: "clear" },
  cloudy: { ru: "облачно", en: "cloudy" },
  fog: { ru: "туман", en: "fog" },
  rain: { ru: "дождь", en: "rain" },
  snow: { ru: "снег", en: "snow" },
  storm: { ru: "гроза", en: "thunderstorms" },
};

/**
 * Turns the numbers into what to actually do about them. The point of the
 * module is advice, not a readout: a temperature alone still leaves the user
 * deciding what it means for their coat.
 */
export function adviceFor(w: WeatherNow, lang: "ru" | "en"): string[] {
  const sky = skyFor(w.code);
  const felt = w.feelsLike;
  const tips: string[] = [];

  if (lang === "ru") {
    if (felt <= -10) tips.push("Сильный мороз — пуховик, шапка, перчатки");
    else if (felt <= 0) tips.push("Мороз — тёплая куртка и шапка");
    else if (felt <= 8) tips.push("Холодно — куртка и что-то под неё");
    else if (felt <= 15) tips.push("Прохладно — хватит лёгкой куртки");
    else if (felt <= 22) tips.push("Комфортно — рубашка или худи");
    else if (felt <= 28) tips.push("Тепло — можно налегке");
    else tips.push("Жарко — лёгкая одежда и вода с собой");

    if (sky === "rain") tips.push("Возьмите зонт");
    if (sky === "storm") tips.push("Гроза — лучше переждать дома");
    if (sky === "snow") tips.push("Снег — обувь с протектором");
    if (sky === "fog") tips.push("Туман — за рулём держите дистанцию");
    if (sky === "clear" && w.isDay && w.temperature >= 20) tips.push("Солнце — пригодятся очки");
    if (w.windKph >= 30) tips.push("Сильный ветер — капюшон вместо зонта");
    if (w.temperature - w.low >= 8) tips.push(`К ночи до ${w.low}° — возьмите слой потеплее`);
    return tips;
  }

  if (felt <= -10) tips.push("Severe cold — heavy coat, hat and gloves");
  else if (felt <= 0) tips.push("Freezing — warm coat and a hat");
  else if (felt <= 8) tips.push("Cold — a coat with a layer under it");
  else if (felt <= 15) tips.push("Cool — a light jacket is enough");
  else if (felt <= 22) tips.push("Comfortable — a shirt or hoodie");
  else if (felt <= 28) tips.push("Warm — travel light");
  else tips.push("Hot — light clothing, and take water");

  if (sky === "rain") tips.push("Take an umbrella");
  if (sky === "storm") tips.push("Thunderstorms — better to wait it out indoors");
  if (sky === "snow") tips.push("Snow — wear boots with grip");
  if (sky === "fog") tips.push("Fog — keep your distance if driving");
  if (sky === "clear" && w.isDay && w.temperature >= 20) tips.push("Sunny — sunglasses will help");
  if (w.windKph >= 30) tips.push("Strong wind — a hood beats an umbrella");
  if (w.temperature - w.low >= 8) tips.push(`Down to ${w.low}° tonight — bring a warmer layer`);
  return tips;
}

/** One sentence the assistant can say aloud. */
export function spokenWeather(w: WeatherNow, lang: "ru" | "en"): string {
  const sky = SKY_LABEL[skyFor(w.code)][lang];
  const tips = adviceFor(w, lang);
  if (lang === "ru") {
    const feels = w.feelsLike !== w.temperature ? `, ощущается как ${w.feelsLike}` : "";
    return `Сейчас ${w.temperature} градусов${feels}, ${sky}. ${tips.slice(0, 2).join(". ")}`;
  }
  const feels = w.feelsLike !== w.temperature ? `, feels like ${w.feelsLike}` : "";
  return `It is ${w.temperature} degrees${feels}, ${sky}. ${tips.slice(0, 2).join(". ")}`;
}
