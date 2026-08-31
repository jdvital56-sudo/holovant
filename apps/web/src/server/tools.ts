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
import { briefingToText, gatherBriefing } from "./briefing";
import { forgetAboutUser, rememberAboutUser } from "./userMemory";
import { isSafeUrl, type QueuedAction } from "./actionTypes";

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

  tools.push(
    {
      type: "function",
      function: {
        name: "morning_briefing",
        description:
          "Everything true about today in one call: the date, the weather, the user's calendar, " +
          "notes written against today's date, and what is still unticked in their notes. Use it " +
          "when they ask what the day looks like, for a briefing, or what is on today. It tells " +
          "you plainly what it could not see — say that rather than filling it in. Follow it with " +
          "a web search when news on their own subjects would belong in the answer.",
        parameters: {
          type: "object",
          properties: {
            place: {
              type: "string",
              description:
                "The city to give weather for. Pass what you know of where they live; leave it " +
                "out if you do not know, and the briefing will say so.",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "remember_about_user",
        description:
          "Record one lasting conclusion about the user — how they work, what they are building, " +
          "what they prefer, what they have decided. Use it when you learn something that will " +
          "still be true next week and would change how you answer then. Not for the passing " +
          "content of this conversation: not what they just asked, not what you just looked up, " +
          "not anything true only today. One short sentence, in their own language. If in doubt, " +
          "do not: a wrong conclusion is repeated in every answer from now on.",
        parameters: {
          type: "object",
          properties: {
            fact: {
              type: "string",
              description: "The conclusion, as one short sentence about the user.",
            },
          },
          required: ["fact"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "forget_about_user",
        description:
          "Remove something you concluded about the user, when they say it is wrong or ask you " +
          "to forget it. Give roughly the wording of the thing to drop.",
        parameters: {
          type: "object",
          properties: {
            fact: { type: "string", description: "Roughly what to forget." },
            everything: {
              type: "boolean",
              description: "True only when they ask you to forget everything you know about them.",
            },
          },
        },
      },
    },
  );

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

      case "morning_briefing": {
        const place = typeof args.place === "string" && args.place.trim() ? args.place.trim() : undefined;
        return briefingToText(await gatherBriefing({ place }));
      }

      case "remember_about_user": {
        const fact = typeof args.fact === "string" ? args.fact : "";
        if (!fact) return "No conclusion was given.";
        const result = await rememberAboutUser(fact);
        // The outcome is reported rather than assumed. A refusal the model
        // reads as success becomes "я запомнил" over a file that never
        // changed, which is the same lie as describing an action not taken.
        return result.stored ? `Remembered: ${fact}` : `Not stored. ${result.reason}`;
      }

      case "forget_about_user": {
        if (args.everything === true) {
          await forgetAboutUser(null);
          return "Forgotten everything about the user.";
        }
        const fact = typeof args.fact === "string" ? args.fact : "";
        if (!fact) return "Nothing was named to forget.";
        const result = await forgetAboutUser(fact);
        return result.removed
          ? `Forgotten: ${result.removed}`
          : `There was nothing remembered about “${fact}”.`;
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

/**
 * The tools that act rather than look something up.
 *
 * These are not run here. The interface lives in the browser, so the server
 * decides on the action, hands back a line saying it is under way, and the
 * action itself travels down the stream to be carried out where the buttons
 * are. One direction only: the model does not wait for a result, because a
 * round trip through the browser to report "the module opened" would cost the
 * user seconds to learn something they can see.
 */
export function actionToolsFor(moduleIds: string[]): ToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "open_module",
        description:
          "Open one of the interface's modules on screen. Use whenever the user asks to see, " +
          "open or switch to something, or when showing it answers them better than describing it.",
        parameters: {
          type: "object",
          properties: {
            module: { type: "string", enum: moduleIds, description: "Which module to open." },
          },
          required: ["module"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "play_music",
        description:
          "Find a track and start it. Use when the user asks for music, an artist or a song.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Artist and title. Empty for background music with nothing specified.",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "pause_music",
        description: "Pause whatever is playing, keeping the track loaded.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "resume_music",
        description: "Resume a paused track.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "play_collection",
        description:
          "Play from one of the user's saved collections of music. Omit the name for the default one.",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "Collection name, if they named one." } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "save_track",
        description: "Save the track playing now into a collection, creating it if it is new.",
        parameters: {
          type: "object",
          properties: { collection: { type: "string", description: "Collection name." } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "open_site",
        description:
          "Open a web page in a new tab. Use after a search when the user wants to go to a " +
          "result, or when they name a site to visit. Give the full https address.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Full https address." },
            title: { type: "string", description: "What the page is, for the user to see." },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_volume",
        description: "Make the sound louder or quieter.",
        parameters: {
          type: "object",
          properties: { direction: { type: "string", enum: ["up", "down"] } },
          required: ["direction"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "show_face",
        description: "Show the assistant's face on screen. Only when asked to appear.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "hide_face",
        description: "Hide the assistant's face and return the dashboard.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];
}

const ACTION_NAMES = new Set<string>([
  "open_module",
  "play_music",
  "pause_music",
  "resume_music",
  "play_collection",
  "save_track",
  "open_site",
  "set_volume",
  "show_face",
  "hide_face",
]);

export function isActionTool(name: string): boolean {
  return ACTION_NAMES.has(name);
}

/**
 * Turns a tool call into an action for the browser, and the sentence the model
 * should carry on from. Returns null when the call cannot be honoured, so the
 * model is told rather than the user being promised something that did not
 * happen.
 */
export function planAction(
  name: string,
  rawArgs: string,
): { action: QueuedAction; note: string } | null {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return null;
  }

  const text = (key: string): string => (typeof args[key] === "string" ? (args[key] as string) : "");

  switch (name) {
    case "open_module":
      if (!text("module")) return null;
      return {
        action: { action: "open_module", args: { module: text("module") } },
        note: `Opening the ${text("module")} module now.`,
      };
    case "play_music":
      return {
        action: { action: "play_music", args: { query: text("query") } },
        note: text("query") ? `Starting ${text("query")}.` : "Starting some music.",
      };
    case "pause_music":
      return { action: { action: "pause_music", args: {} }, note: "Paused." };
    case "resume_music":
      return { action: { action: "resume_music", args: {} }, note: "Resumed." };
    case "play_collection":
      return {
        action: { action: "play_collection", args: { name: text("name") } },
        note: text("name") ? `Playing the ${text("name")} collection.` : "Playing the saved music.",
      };
    case "save_track":
      return {
        action: { action: "save_track", args: { collection: text("collection") } },
        note: "Saving the track that is playing.",
      };
    case "open_site": {
      const url = text("url");
      if (!isSafeUrl(url)) return null;
      return {
        action: { action: "open_site", args: { url, title: text("title") } },
        note: `Opening ${text("title") || url}.`,
      };
    }
    case "set_volume": {
      const direction = text("direction") === "down" ? "down" : "up";
      return {
        action: { action: "set_volume", args: { direction } },
        note: direction === "up" ? "Turning it up." : "Turning it down.",
      };
    }
    case "show_face":
      return { action: { action: "show_face", args: {} }, note: "Appearing." };
    case "hide_face":
      return { action: { action: "hide_face", args: {} }, note: "Hiding." };
    default:
      return null;
  }
}
