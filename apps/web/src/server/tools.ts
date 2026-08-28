/**
 * What the assistant can actually do, as opposed to what it knows.
 *
 * Without these the model is a text box: it has no clock, no internet, and no
 * way to check anything, so it answers questions about today with whatever was
 * in its training data — or, honestly but uselessly, says it has no access.
 * The application has had internet all along; the model did not.
 *
 * Each tool is small, named for what it does, and returns compact text. The
 * result is read by a model whose answer is then spoken aloud, so a page of
 * JSON costs the user seconds of silence.
 */

import { searchWeb, isSearchConfigured } from "./webSearch";
import { fetchWeather } from "./weather";
import { searchBrain, isBrainConnected } from "./brain";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Weather codes matter to a person as words, not numbers. */
const CONDITIONS: Record<number, string> = {
  0: "ясно",
  1: "почти ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "изморозь",
  51: "морось",
  53: "морось",
  55: "сильная морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  80: "ливень",
  81: "ливень",
  82: "сильный ливень",
  95: "гроза",
  96: "гроза с градом",
  99: "сильная гроза с градом",
};

export function toolsFor(lang: "ru" | "en"): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the web for current information. Use this for anything that happened recently, " +
          "any price, score, schedule or news, and any question where being out of date would be " +
          "wrong. Prefer calling it over answering from memory when the answer could have changed.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "What to search for, phrased as a search query.",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_weather",
        description:
          "Current weather and today's high and low for a place. Use for any weather question.",
        parameters: {
          type: "object",
          properties: {
            place: {
              type: "string",
              description: "City or place name, for example “Киев” or “Barcelona”.",
            },
          },
          required: ["place"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_current_time",
        description:
          "The date and time right now. Call this before any answer that depends on today's " +
          "date — you do not otherwise know what day it is.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  if (isBrainConnected()) {
    tools.push({
      type: "function",
      function: {
        name: "search_notes",
        description:
          "Search the user's own notes. Use for anything about their projects, decisions or " +
          "work — what is written there outranks general knowledge, because it is what they " +
          "actually decided.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to look for in the notes." },
          },
          required: ["query"],
        },
      },
    });
  }

  // Nothing to say about the language yet, but the signature takes it so a
  // localised description can be added without changing every call site.
  void lang;
  return tools;
}

/**
 * Runs one tool and returns what the model should see. Failures come back as
 * plain sentences rather than thrown: the model can say "I could not check"
 * far more usefully than the request can fail.
 */
export async function runTool(name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return "The arguments for that tool were not valid JSON.";
  }

  try {
    switch (name) {
      case "web_search": {
        if (!isSearchConfigured()) return "Web search is not configured on this server.";
        const query = typeof args.query === "string" ? args.query : "";
        if (!query) return "No search query was given.";
        const results = await searchWeb(query, 5);
        if (!results.length) return `Nothing found for “${query}”.`;
        return results
          .map((r, i) => `${i + 1}. ${r.title}\n${r.description}\n${r.url}`)
          .join("\n\n");
      }

      case "get_weather": {
        const place = typeof args.place === "string" ? args.place : "";
        if (!place) return "No place was given.";
        const w = await fetchWeather({ place, lang: "ru" });
        const condition = CONDITIONS[w.code] ?? "";
        return [
          `${w.place}: ${w.temperature}°C`,
          `ощущается как ${w.feelsLike}°C`,
          condition,
          `ветер ${w.windKph} км/ч`,
          `влажность ${w.humidity}%`,
          `сегодня от ${w.low}°C до ${w.high}°C`,
          w.precipitationMm > 0 ? `осадки ${w.precipitationMm} мм` : "",
        ]
          .filter(Boolean)
          .join(", ");
      }

      case "get_current_time": {
        const now = new Date();
        return [
          `ISO: ${now.toISOString()}`,
          `Local: ${now.toLocaleString("ru-RU", { dateStyle: "full", timeStyle: "short" })}`,
        ].join("\n");
      }

      case "search_notes": {
        const query = typeof args.query === "string" ? args.query : "";
        if (!query) return "No query was given.";
        const notes = await searchBrain(query, 4);
        if (!notes.length) return `Nothing in the notes about “${query}”.`;
        return notes.map((n) => `# ${n.title}\n${n.excerpt}`).join("\n\n");
      }

      default:
        return `There is no tool called ${name}.`;
    }
  } catch (error) {
    // The detail belongs in the log; the model gets something it can say.
    console.error(`[tools] ${name} failed:`, error);
    return `That check failed and could not be completed.`;
  }
}
