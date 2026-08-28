import { create } from "zustand";
import { speak, speakQueued } from "./speech";
import { searchBrain } from "@/modules/brain/brainStore";
import { ASSISTANT_NAME } from "@/config/assistant";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatStatus = "idle" | "thinking" | "streaming" | "error";

interface ChatState {
  status: ChatStatus;
  /** The full conversation, so follow-up questions have something to refer to. */
  history: ChatTurn[];
  /** The answer as it is still arriving. */
  partial: string;
  errorMessage: string | null;
}

export const useChatStore = create<ChatState>(() => ({
  status: "idle",
  history: [],
  partial: "",
  errorMessage: null,
}));

/** Keeps the conversation from growing without bound over a long session. */
const MAX_TURNS = 12;

let activeRequest = 0;

/**
 * Splits off whole sentences as they complete, so speech can start while the
 * rest of the answer is still being written. Waiting for the final token would
 * add the whole generation time to the silence before the first word.
 */
function takeCompleteSentences(buffer: string): { spoken: string; rest: string } {
  const match = buffer.match(/^([\s\S]*?[.!?…])\s+/);
  if (!match) return { spoken: "", rest: buffer };
  return { spoken: match[1].trim(), rest: buffer.slice(match[0].length) };
}

export function clearChat() {
  activeRequest++;
  useChatStore.setState({ status: "idle", history: [], partial: "", errorMessage: null });
}

export async function askAssistant(question: string, moduleContext: string | null, lang: "ru" | "en") {
  const requestId = ++activeRequest;
  const history = [...useChatStore.getState().history, { role: "user" as const, content: question }];

  // The notes themselves are gathered server-side inside /api/chat — what the
  // model is told is in the user's knowledge base is not the client's to
  // choose. This call only lights up the Brain panel with what was consulted.
  void searchBrain(question).catch(() => []);

  useChatStore.setState({
    status: "thinking",
    history: history.slice(-MAX_TURNS),
    partial: "",
    errorMessage: null,
  });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history,
        moduleContext,
        lang,
        assistantName: ASSISTANT_NAME,
      }),
    });

    if (response.status === 501) {
      const message =
        lang === "ru"
          ? "Языковая модель не подключена — нужен ключ."
          : "No language model is connected — a key is needed.";
      useChatStore.setState({ status: "error", errorMessage: message });
      speak(message, lang);
      return;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Request failed (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let unspoken = "";

    useChatStore.setState({ status: "streaming" });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (requestId !== activeRequest) return; // A newer question replaced this one.

      const piece = decoder.decode(value, { stream: true });

      // The server marks a mid-stream failure inline, because the status code
      // is already sent by then. Without this the marker is read aloud, and
      // the synthesiser pronounces the brackets.
      if ((full + piece).includes("[error]")) {
        throw new Error("Stream failed mid-answer.");
      }

      full += piece;
      unspoken += piece;
      useChatStore.setState({ partial: full });

      const { spoken, rest } = takeCompleteSentences(unspoken);
      if (spoken) {
        unspoken = rest;
        // Queued, not interrupting: an answer arrives a sentence at a time,
        // and interrupting on each one would leave only the last audible.
        speakQueued(spoken, lang);
      }
    }

    if (requestId !== activeRequest) return;

    // Whatever is left never ended in punctuation; it is still the answer.
    const tail = unspoken.trim();
    if (tail) speakQueued(tail, lang);

    useChatStore.setState({
      status: "idle",
      partial: "",
      history: [...history, { role: "assistant" as const, content: full.trim() }].slice(-MAX_TURNS),
    });
  } catch {
    if (requestId !== activeRequest) return;
    const message =
      lang === "ru" ? "Не смог получить ответ" : "Could not get an answer";
    useChatStore.setState({ status: "error", errorMessage: message, partial: "" });
    speak(message, lang);
  }
}
