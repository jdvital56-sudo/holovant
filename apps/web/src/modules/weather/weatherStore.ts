import { create } from "zustand";
import type { WeatherNow } from "@/app/api/weather/route";

export type WeatherStatus = "idle" | "loading" | "ready" | "error";

interface WeatherState {
  status: WeatherStatus;
  data: WeatherNow | null;
  errorMessage: string | null;
}

export const useWeatherStore = create<WeatherState>(() => ({
  status: "idle",
  data: null,
  errorMessage: null,
}));

/** Geolocation can hang indefinitely if the user never answers the prompt. */
const LOCATION_TIMEOUT_MS = 7000;

function currentPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/**
 * Fetches for a named place, or for wherever the browser says the user is.
 * Returns the reading so a caller can speak it, rather than only storing it.
 */
export async function loadWeather(place?: string): Promise<WeatherNow | null> {
  useWeatherStore.setState({ status: "loading", errorMessage: null });

  let query = place ? `place=${encodeURIComponent(place)}` : "";
  if (!query) {
    const position = await currentPosition();
    if (!position) {
      useWeatherStore.setState({
        status: "error",
        errorMessage: "Location unavailable — allow location access, or name a city.",
      });
      return null;
    }
    query = `lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
  }

  try {
    const response = await fetch(`/api/weather?${query}`);
    const payload = (await response.json()) as WeatherNow & { error?: string };
    if (!response.ok) {
      useWeatherStore.setState({ status: "error", errorMessage: payload.error ?? "Weather failed." });
      return null;
    }
    useWeatherStore.setState({ status: "ready", data: payload, errorMessage: null });
    return payload;
  } catch {
    useWeatherStore.setState({ status: "error", errorMessage: "Could not reach the weather service." });
    return null;
  }
}
