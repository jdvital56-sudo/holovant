import { NextResponse } from "next/server";
import { streamChat, isLlmConfigured, type ChatMessage } from "@/server/llm";

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
      "You are Holovant, a spatial operating system the user talks to out loud.",
      "Your answers are spoken aloud, so keep them short: two or three sentences unless asked for more.",
      "Never use markdown, bullet points, headings or emoji — none of it can be spoken.",
      "Give a direct answer first. Advise rather than list options.",
      "If you do not know something, say so in one sentence instead of guessing.",
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
  let knowledge: string | null;

  try {
    const body = (await request.json()) as {
      messages?: unknown;
      moduleContext?: unknown;
      lang?: unknown;
      knowledge?: unknown;
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
    moduleContext = typeof body.moduleContext === "string" ? body.moduleContext : null;
    lang = typeof body.lang === "string" ? body.lang : "ru";
    // Capped: a long excerpt would crowd the question out of the context.
    knowledge =
      typeof body.knowledge === "string" ? body.knowledge.slice(0, MAX_KNOWLEDGE_CHARS) : null;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!history.length) return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });

  const messages = [systemPrompt(moduleContext, lang, knowledge), ...history];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of streamChat(messages)) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Model request failed.";
        // The stream has already started, so the failure has to travel inside
        // it — a status code can no longer be changed at this point.
        controller.enqueue(encoder.encode(`\n[error] ${message}`));
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
