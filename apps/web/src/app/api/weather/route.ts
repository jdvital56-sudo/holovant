import { NextResponse } from "next/server";

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

/**
 * Open-Meteo needs no API key and no account, so weather works out of the box
 * rather than waiting on credentials the way the account-bound modules do.
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const TIMEOUT_MS = 8000;

interface GeoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
}

async function resolvePlace(query: string, lang: "ru" | "en"): Promise<GeoResult | null> {
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=${lang}&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: GeoResult[] };
  return payload.results?.[0] ?? null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const place = params.get("place")?.trim();
  const lang = params.get("lang") === "en" ? "en" : "ru";
  let latitude = Number(params.get("lat"));
  let longitude = Number(params.get("lon"));
  let placeName = place ?? "";

  try {
    if (place) {
      const geo = await resolvePlace(place, lang);
      // Compared against null, not truthiness: the equator and the Greenwich
      // meridian are zero, and a falsy check rejects every place on them.
      if (geo?.latitude == null || geo.longitude == null) {
        return NextResponse.json({ error: `Could not find “${place}”.` }, { status: 404 });
      }
      latitude = geo.latitude;
      longitude = geo.longitude;
      placeName = [geo.name, geo.country].filter(Boolean).join(", ");
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "No location given." }, { status: 400 });
    }

    // Out-of-range coordinates would otherwise travel to the provider and come
    // back as an opaque 502, which reads as "the weather service is down".
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: "Coordinates out of range." }, { status: 400 });
    }

    const url =
      `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day` +
      `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      return NextResponse.json({ error: `Weather provider returned ${response.status}.` }, { status: 502 });
    }

    const payload = (await response.json()) as {
      current?: Record<string, number>;
      daily?: Record<string, number[]>;
    };
    const c = payload.current ?? {};
    const d = payload.daily ?? {};

    const weather: WeatherNow = {
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

    return NextResponse.json(weather);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Weather request timed out." : "Weather request failed." },
      { status: 504 },
    );
  }
}
