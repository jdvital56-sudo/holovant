import { NextResponse } from "next/server";
import { streamChat, isLlmConfigured, type ChatMessage } from "@/server/llm";
import { searchBrain } from "@/server/brain";
import { moduleRegistry } from "@/modules/registry";

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
      "If you do not know something, say so in one sentence instead of guessing — a confident wrong answer costs the user more than an admission.",
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
      claimedModule && moduleRegistry.some((m) => m.label === claimedModule) ? claimedModule : null;
    lang = body.lang === "en" ? "en" : "ru";
    assistantName =
      typeof body.assistantName === "string" && body.assistantName.trim()
        ? body.assistantName.trim().slice(0, 40)
        : "Vita";
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

  const messages = [systemPrompt(moduleContext, lang, knowledge, assistantName), ...history];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of streamChat(messages)) {
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
