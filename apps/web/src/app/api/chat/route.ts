import { NextResponse } from "next/server";
import { streamChat, isLlmConfigured, type ChatMessage } from "@/server/llm";
import { toolsFor, actionToolsFor } from "@/server/tools";
import { searchBrain } from "@/server/brain";
import { getUserPlace, readUserMemory, summariseForPrompt } from "@/server/userMemory";
import { situation, stableBrief } from "@/server/prompt";
import { stripControlCharacters } from "@/server/untrustedText";
import { recordExchange } from "@/server/journal";
import { TOOL_MARKER } from "@/server/toolMarker";
import { extractActions } from "@/server/actionTypes";
import { MODULE_IDS, isModuleLabel } from "@/modules/catalog";

export const runtime = "nodejs";

/** Enough for context without letting an old conversation crowd out the question. */
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_KNOWLEDGE_CHARS = 4000;


/**
 * The answer as it should read in his vault: the words, without the machinery.
 *
 * The stream carries action envelopes between two invisible characters and a
 * marker that means "checking" — both are instructions to the browser, and
 * neither is anything he said or was told.
 */
function forJournal(streamed: string): string {
  // extractActions is the same stripper the browser uses, so the journal holds
  // exactly the words he heard. A second copy written here is how the two
  // drift apart — and since the envelope markers are invisible characters, a
  // mistake in one would not be visible in the file either.
  return extractActions(streamed).text.split(TOOL_MARKER).join("").trim();
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
  // Three reads that do not depend on one another, done at once. They used to
  // be awaited one after the other before the model was even called.
  const [notes, facts, place] = await Promise.all([
    searchBrain(question).catch(() => []),
    readUserMemory().catch(() => []),
    getUserPlace().catch(() => null),
  ]);
  // Stripped of invisible characters before it goes anywhere near the prompt.
  // A note can arrive from anywhere — synced from another machine, pasted from
  // a page — and an action envelope is made of two characters nobody can see.
  // His notes and the assistant's own past conversations are found by the
  // same search but are not the same kind of thing, and go to the model under
  // different headings — see prompt.ts.
  const asText = (found: typeof notes) =>
    found.length
      ? stripControlCharacters(
          found
            .slice(0, 3)
            .map((note) => `# ${note.title}\n${note.excerpt}`)
            .join("\n\n"),
        ).slice(0, MAX_KNOWLEDGE_CHARS)
      : null;
  const knowledge = asText(notes.filter((note) => note.kind !== "conversation"));
  const pastConversations = asText(notes.filter((note) => note.kind === "conversation"));

  // Read here rather than accepted from the caller, for the same reason the
  // notes are: this text goes into the system prompt, and anything a caller
  // can put there is an instruction to the model.
  const remembered = summariseForPrompt(facts);
  // He edits this file by hand in Obsidian, and it syncs from other machines.
  const aboutUser = remembered ? stripControlCharacters(remembered) : null;

  // The brief that never changes goes first, alone, so the model's cache can
  // match it; everything that changes follows it.
  const messages = [
    stableBrief(assistantName, lang),
    situation({ now: new Date(), place, lang, moduleContext, aboutUser, knowledge, pastConversations }),
    ...history,
  ];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Kept so the exchange can be written into his vault when the stream
      // ends. Done here rather than in the browser because the panel is wiped
      // the moment he closes it — the record must not depend on a window
      // staying open.
      let spoken = "";
      try {
        for await (const piece of streamChat(messages, {
          tools: [
            ...toolsFor(lang === "en" ? "en" : "ru"),
            ...actionToolsFor(MODULE_IDS),
          ],
        })) {
          spoken += piece;
          controller.enqueue(encoder.encode(piece));
        }
        // Only a real answer is recorded. A failure is written nowhere: it
        // would come back as a search result later and be read as something
        // he was actually told.
        void recordExchange(question, forJournal(spoken));
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
