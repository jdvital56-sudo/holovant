import { NextResponse } from "next/server";
import { fetchWeather, WeatherError, type WeatherNow } from "@/server/weather";

export type { WeatherNow };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const place = params.get("place")?.trim();
  const lang = params.get("lang") === "en" ? "en" : "ru";

  try {
    const weather = await fetchWeather({
      place: place || null,
      latitude: Number(params.get("lat")),
      longitude: Number(params.get("lon")),
      lang,
    });
    return NextResponse.json(weather);
  } catch (err) {
    if (err instanceof WeatherError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Weather request timed out." : "Weather request failed." },
      { status: 504 },
    );
  }
}
