/**
 * Talking to a language model, without being married to one.
 *
 * Everything here speaks the OpenAI chat-completions shape, which DeepSeek,
 * OpenAI, Groq, OpenRouter, Together and a local Ollama all accept. Changing
 * provider is therefore a change of base URL and model name, not of code —
 * which matters for a product that will outlive whichever model is cheapest
 * this year.
 */

import { runTool, isActionTool, planAction, type ToolDefinition } from "./tools";
import { encodeAction } from "./actionTypes";
import { TOOL_MARKER } from "./toolMarker";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** DeepSeek by default: it is inexpensive, fast, and already in use here. */
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

/** A spoken answer that takes longer than this has stopped being a conversation. */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * How many times the model may call tools before it must answer. Three covers
 * "check the date, then search, then answer"; more than that and it is looping
 * rather than working, and the user is listening to silence.
 */
const MAX_TOOL_ROUNDS = 3;


export function llmConfig() {
  return {
    baseUrl: process.env.HOLOVANT_LLM_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.HOLOVANT_LLM_API_KEY ?? "",
    model: process.env.HOLOVANT_LLM_MODEL || DEFAULT_MODEL,
  };
}

export function isLlmConfigured(): boolean {
  return Boolean(llmConfig().apiKey);
}

interface StreamDelta {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

interface StreamChunk {
  choices?: Array<{ delta?: StreamDelta; finish_reason?: string }>;
}

/** What one pass over the model produced: text for the user, or tools to run. */
interface PassResult {
  toolCalls: ToolCall[];
  finishReason: string | null;
}

/**
 * One request to the model. Text deltas are yielded as they arrive; tool calls
 * are accumulated instead, because a tool call is not something to read out.
 */
async function* runPass(
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  signal: AbortSignal | undefined,
  collected: PassResult,
): AsyncGenerator<string> {
  const { baseUrl, apiKey, model } = llmConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      // Low temperature and a tight ceiling: answers are spoken aloud and
      // should be two or three sentences, not an essay that wanders.
      temperature: 0.4,
      max_tokens: 320,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    }),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    // The upstream body can echo the request, so only the status travels back.
    throw new Error(`Model provider returned ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  /** Fragments arrive split across chunks and are joined by index. */
  const building = new Map<number, ToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Server-sent events arrive split across reads, so only whole lines are
    // parsed and any partial tail is carried into the next chunk.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        collected.toolCalls = [...building.values()];
        return;
      }
      try {
        const chunk = JSON.parse(payload) as StreamChunk;
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason) collected.finishReason = choice.finish_reason;

        const delta = choice?.delta;
        if (delta?.content) yield delta.content;

        for (const part of delta?.tool_calls ?? []) {
          const existing = building.get(part.index) ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (part.id) existing.id = part.id;
          if (part.function?.name) existing.function.name += part.function.name;
          if (part.function?.arguments) existing.function.arguments += part.function.arguments;
          building.set(part.index, existing);
        }
      } catch {
        // A malformed chunk is not worth ending a good answer over.
      }
    }
  }

  collected.toolCalls = [...building.values()];
}

/**
 * Yields the answer as it arrives rather than when it is finished, so speech
 * can begin on the first complete sentence instead of after the last word.
 *
 * When tools are given, the model may ask for one before answering. Those
 * rounds produce no text — the user hears nothing until the real answer
 * starts, which is why the number of them is capped.
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: { tools?: ToolDefinition[]; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const { apiKey } = llmConfig();
  if (!apiKey) throw new Error("No language model is configured.");

  const conversation = [...messages];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const collected: PassResult = { toolCalls: [], finishReason: null };
    // On the last permitted round the tools are withheld, which forces an
    // answer instead of a fourth request for one.
    const tools = round < MAX_TOOL_ROUNDS ? options.tools : undefined;

    let sawText = false;
    for await (const piece of runPass(conversation, tools, options.signal, collected)) {
      sawText = true;
      yield piece;
    }

    if (!collected.toolCalls.length) return;

    // Text and a tool call in the same turn: the text has already been spoken,
    // so running the tool would answer a question the user has heard answered.
    if (sawText) return;

    // Checking takes seconds, and until now those seconds were silence — the
    // system looked like it had stopped rather than like it was working. The
    // client turns this into a short spoken acknowledgement and drops it from
    // the answer.
    if (round === 0) yield TOOL_MARKER;

    conversation.push({ role: "assistant", content: "", tool_calls: collected.toolCalls });

    // Sequential rather than parallel: these are one or two cheap calls, and
    // ordering keeps the transcript readable when something goes wrong.
    for (const call of collected.toolCalls) {
      // An action belongs to the browser, where the interface is. The server
      // decides on it, sends it down the stream, and tells the model it is
      // under way — it does not wait to be told the module opened, which the
      // user can see for themselves.
      if (isActionTool(call.function.name)) {
        const planned = planAction(call.function.name, call.function.arguments);
        if (planned) {
          yield encodeAction(planned.action);
          conversation.push({ role: "tool", tool_call_id: call.id, content: planned.note });
        } else {
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: "That could not be done. Tell the user plainly rather than claiming it worked.",
          });
        }
        continue;
      }

      const result = await runTool(call.function.name, call.function.arguments);
      conversation.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
}
