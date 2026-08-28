/**
 * Live weather, from Open-Meteo. No key and no account, which is why the
 * weather module has real data while the account-bound ones do not.
 *
 * Lives here rather than in the route because the assistant needs it too: a
 * spoken question about the weather has to reach the same source the module
 * shows, or the two disagree in front of the user.
 */

export interface WeatherNow {
  place: string;
  temperature: number;
  feelsLike: number;
  windKph: number;
  precipitationMm: number;
  humidity: number;
  code: number;
  isDay: boolean;
  high: number;
  low: number;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const TIMEOUT_MS = 8000;

interface GeoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
}

export class WeatherError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function resolvePlace(query: string, lang: "ru" | "en"): Promise<GeoResult | null> {
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=${lang}&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: GeoResult[] };
  return payload.results?.[0] ?? null;
}

export async function fetchWeather(options: {
  place?: string | null;
  latitude?: number;
  longitude?: number;
  lang?: "ru" | "en";
}): Promise<WeatherNow> {
  const lang = options.lang ?? "ru";
  let latitude = options.latitude ?? NaN;
  let longitude = options.longitude ?? NaN;
  let placeName = options.place ?? "";

  if (options.place) {
    const geo = await resolvePlace(options.place, lang);
    // Compared against null, not truthiness: the equator and the Greenwich
    // meridian are zero, and a falsy check rejects every place on them.
    if (geo?.latitude == null || geo.longitude == null) {
      throw new WeatherError(`Could not find “${options.place}”.`, 404);
    }
    latitude = geo.latitude;
    longitude = geo.longitude;
    placeName = [geo.name, geo.country].filter(Boolean).join(", ");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new WeatherError("No location given.", 400);
  }
  // Out-of-range coordinates would otherwise travel to the provider and come
  // back as an opaque 502, which reads as "the weather service is down".
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new WeatherError("Coordinates out of range.", 400);
  }

  const url =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new WeatherError(`Weather provider returned ${response.status}.`, 502);
  }

  const payload = (await response.json()) as {
    current?: Record<string, number>;
    daily?: Record<string, number[]>;
  };
  const c = payload.current ?? {};
  const d = payload.daily ?? {};

  return {
    place: placeName || "your location",
    temperature: Math.round(c.temperature_2m ?? 0),
    feelsLike: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0),
    windKph: Math.round(c.wind_speed_10m ?? 0),
    precipitationMm: c.precipitation ?? 0,
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    code: c.weather_code ?? 0,
    isDay: (c.is_day ?? 1) === 1,
    high: Math.round(d.temperature_2m_max?.[0] ?? 0),
    low: Math.round(d.temperature_2m_min?.[0] ?? 0),
  };
}
