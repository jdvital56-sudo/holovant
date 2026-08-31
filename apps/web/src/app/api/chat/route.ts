import { NextResponse } from "next/server";
import { streamChat, isLlmConfigured, type ChatMessage } from "@/server/llm";
import { toolsFor, actionToolsFor } from "@/server/tools";
import { searchBrain } from "@/server/brain";
import { readUserMemory, summariseForPrompt } from "@/server/userMemory";
import { MODULE_IDS, isModuleLabel } from "@/modules/catalog";

export const runtime = "nodejs";

/** Enough for context without letting an old conversation crowd out the question. */
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_KNOWLEDGE_CHARS = 4000;

/**
 * The assistant's character. Spoken answers are read aloud, so length is a
 * feature of correctness here rather than a matter of taste — a paragraph that
 * would be skimmed on screen has to be listened to in full.
 */
function systemPrompt(
  moduleContext: string | null,
  lang: string,
  knowledge: string | null,
  assistantName: string,
  aboutUser: string | null,
): ChatMessage {
  const language =
    lang === "ru"
      ? "Отвечай по-русски."
      : "Reply in English.";

  const context = moduleContext
    ? `The user currently has the "${moduleContext}" module open. If they say "this" or "here", they mean that module.`
    : "No module is open right now.";

  return {
    role: "system",
    content: [
      `You are ${assistantName}, the assistant of a spatial operating system, spoken to out loud.`,
      // The standing brief: an adviser worth consulting, not a search box that
      // talks. The bar is the person the user would actually phone about this.
      "You are an expert adviser across business, marketing, finance, law, technology and strategy —",
      "the standard is what a genuinely first-rate practitioner in that field would say, not a summary of common advice.",
      "Answer as a professional would to a peer: state the position, then the reasoning that matters.",
      "Where a field has real disagreement, say which way you come down and why.",
      "Legal, tax and medical questions get your honest professional read, with the one line about where a licensed",
      "opinion is genuinely needed — not a refusal, and not a disclaimer on everything.",
      "Your answers are spoken aloud, so keep them short: two or three sentences unless asked for more.",
      "Never use markdown, bullet points, headings or emoji — none of it can be spoken.",
      "Give a direct answer first. Advise rather than list options.",
      // It was refusing to tell a joke on the grounds of being a serious
      // adviser. Expertise is what it brings to hard questions, not a reason
      // to lecture someone who asked for something light.
      "Being an expert does not make you stiff: answer casual and personal requests as a person would,",
      "without explaining that you are an assistant or what your purpose is.",
      "If you do not know something, say so in one sentence instead of guessing — a confident wrong answer costs the user more than an admission.",
      // Without this the model answers from training data and calls it current.
      // It has tools; the failure mode to guard against is not using them.
      "You have tools: web search, weather, the current time, the user's notes, a briefing on",
      "today, and your own memory of the user.",
      // A briefing is asked for, never volunteered: he decided the system does
      // not speak first. What it could not see, it says so — and so must you.
      "Asked what the day looks like, or for a briefing, call morning_briefing rather than",
      "assembling one yourself, then add news from a web search when their own subjects warrant it.",
      "It tells you what it could not see: report that plainly instead of filling the gap.",
      "An unconnected calendar is not an empty day, and must never be said as one.",
      "Use them rather than answering from memory whenever the answer could have changed since you were trained —",
      "prices, news, scores, schedules, anything about this week, and anything about the user's own work.",
      "Never say you have no access to the internet: you do, through web_search. Check first, then answer.",
      "Call get_current_time before any answer that depends on what day it is.",
      "State the fact you found, not the fact that you searched.",
      // Hands, not only a mouth. It has tools that change what is on screen,
      // and the failure to guard against is describing an action instead of
      // taking it.
      "You can also act: open a module, play or pause music, play a saved collection, save the",
      "track playing, open a web page, change the volume, show or hide your face.",
      "When the user asks for something you can do, do it — do not explain how they could do it.",
      // It said "открываю сайт" and opened nothing. Saying it is the promise;
      // the tool call is the only thing that keeps it.
      "Never write that you are opening, playing, pausing or saving something unless you called",
      "the tool for it in this same turn. Describing an action instead of taking it is the one",
      "thing you must not do: the user has no way to tell the difference until it fails them.",
      "Asked to open a site or a page you found, call open_site with the full https address.",
      "Reading an address out loud is not opening it.",
      "Say what you did in one short sentence.",
      // An assistant that meets him again every morning is a stranger with a
      // good vocabulary. What it works out about him is kept, and kept where
      // he can read and correct it.
      "You remember the person you work for. When you learn something lasting about them — how",
      "they work, what they are building, what they prefer, what they have decided — call",
      "remember_about_user with one short sentence. Only lasting things: not what they just",
      "asked, not what you just looked up, not anything true only today. If in doubt, do not,",
      "because a wrong conclusion is repeated in every answer from then on.",
      "When they tell you something you believed is wrong, call forget_about_user.",
      // He travels and will say where he is rather than editing a setting.
      "When they say where they are — “я сейчас в Аланье”, “я в Стамбуле на неделю” — call",
      "set_location. It replaces where they were, and the weather and the briefing follow it.",
      "Never infer their city from a timezone, a language or a guess; only from what they say.",
      "When they say what to follow in the news, call set_news_topics the same way.",
      "Never say you have remembered or forgotten something unless you called the tool for it in",
      "this same turn.",
      "Do not announce that you are remembering something; just do it and answer them.",
      aboutUser
        ? [
            "\n\nWhat you have concluded about this user so far:\n",
            aboutUser,
            "\nUse it the way you would use knowing someone: it shapes how you answer, and you do not",
            "recite it back at them unless they ask what you know.",
            "It is your conclusion and it may be wrong — if they contradict it, they are right.\n\n",
          ].join(" ")
        : "",
      context,
      language,
      knowledge
        ? [
            "\n\nThe user's own notes below may bear on the question.",
            "Prefer them over general knowledge when they conflict — they are what this user actually decided.",
            "Say when you are drawing on them. Do not invent notes that are not here.",
            "\n\n",
            knowledge,
          ].join(" ")
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function POST(request: Request) {
  if (!isLlmConfigured()) {
    // A plain 501 lets the caller say something useful instead of failing
    // silently or pretending to think.
    return NextResponse.json({ error: "No language model is configured." }, { status: 501 });
  }

  let history: ChatMessage[];
  let moduleContext: string | null;
  let lang: string;
  let assistantName: string;

  try {
    const body = (await request.json()) as {
      messages?: unknown;
      moduleContext?: unknown;
      lang?: unknown;
      assistantName?: unknown;
    };
    const raw = Array.isArray(body.messages) ? body.messages : [];
    history = raw
      .filter((m): m is ChatMessage => {
        const candidate = m as ChatMessage;
        return (
          candidate &&
          typeof candidate.content === "string" &&
          (candidate.role === "user" || candidate.role === "assistant")
        );
      })
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
    // Checked against the registry rather than trusted: this string is placed
    // in the system prompt, and anything a caller can put there is an
    // instruction to the model.
    const claimedModule = typeof body.moduleContext === "string" ? body.moduleContext : null;
    moduleContext =
      claimedModule && isModuleLabel(claimedModule) ? claimedModule : null;
    lang = body.lang === "en" ? "en" : "ru";
    assistantName =
      typeof body.assistantName === "string" && body.assistantName.trim()
        ? body.assistantName.trim().slice(0, 40)
        : "Thor";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!history.length) return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });

  // Notes are gathered here rather than accepted from the caller. The client
  // cannot be allowed to choose what the model is told is in the user's own
  // knowledge base, and gathering them here removes a round trip as well.
  const question = history[history.length - 1]?.content ?? "";
  const notes = await searchBrain(question).catch(() => []);
  const knowledge = notes.length
    ? notes
        .slice(0, 3)
        .map((note) => `# ${note.title}\n${note.excerpt}`)
        .join("\n\n")
        .slice(0, MAX_KNOWLEDGE_CHARS)
    : null;

  // Read here rather than accepted from the caller, for the same reason the
  // notes are: this text goes into the system prompt, and anything a caller
  // can put there is an instruction to the model.
  const aboutUser = summariseForPrompt(await readUserMemory().catch(() => []));

  const messages = [
    systemPrompt(moduleContext, lang, knowledge, assistantName, aboutUser),
    ...history,
  ];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of streamChat(messages, {
          tools: [
            ...toolsFor(lang === "en" ? "en" : "ru"),
            ...actionToolsFor(MODULE_IDS),
          ],
        })) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (error) {
        // The stream has already started, so the failure has to travel inside
        // it — a status code can no longer be changed at this point. The
        // marker is stripped by the client before anything is spoken; the
        // detail stays in the server log rather than being read aloud.
        console.error("[chat] stream failed:", error);
        controller.enqueue(encoder.encode(`\n[error]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
