/**
 * Talking to a language model, without being married to one.
 *
 * Everything here speaks the OpenAI chat-completions shape, which DeepSeek,
 * OpenAI, Groq, OpenRouter, Together and a local Ollama all accept. Changing
 * provider is therefore a change of base URL and model name, not of code —
 * which matters for a product that will outlive whichever model is cheapest
 * this year.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** DeepSeek by default: it is inexpensive, fast, and already in use here. */
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

/** A spoken answer that takes longer than this has stopped being a conversation. */
const REQUEST_TIMEOUT_MS = 30000;

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

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

/**
 * Yields the answer as it arrives rather than when it is finished, so speech
 * can begin on the first complete sentence instead of after the last word.
 */
export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const { baseUrl, apiKey, model } = llmConfig();
  if (!apiKey) throw new Error("No language model is configured.");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.6, max_tokens: 700 }),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    // The upstream body can echo the request, so only the status travels back.
    throw new Error(`Model provider returned ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
      if (payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload) as StreamChunk;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // A malformed chunk is not worth ending a good answer over.
      }
    }
  }
}
