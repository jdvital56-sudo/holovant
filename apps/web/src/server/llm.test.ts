import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tool loop in llm.ts had been wrong once in each direction and never had
 * a test: "text and a tool call in one turn ends the turn" was written, then
 * reversed when the assistant promised to check the news and never did.
 *
 * The model is replaced by a fake that streams the same server-sent events a
 * real provider sends, so what is checked is the loop itself.
 */

const started: string[] = [];
const finished: string[] = [];

vi.mock("./tools", () => ({
  isActionTool: () => false,
  planAction: () => null,
  runTool: async (name: string) => {
    started.push(name);
    // Long enough that running two in a row is plainly slower than together.
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (name === "broken") throw new Error("lookup exploded");
    finished.push(name);
    return `${name} result`;
  },
}));

import { streamChat, type ChatMessage } from "./llm";

/** One server-sent-events body, the way an OpenAI-compatible provider sends it. */
function sse(chunks: object[]): Response {
  const lines = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(new TextEncoder().encode(lines), { status: 200 });
}

const toolCall = (index: number, id: string, name: string) => ({
  choices: [
    {
      delta: {
        tool_calls: [{ index, id, type: "function", function: { name, arguments: "{}" } }],
      },
    },
  ],
});

const text = (content: string) => ({ choices: [{ delta: { content } }] });

let requests: Array<{ messages: ChatMessage[] }> = [];

function fakeModel(passes: Response[]) {
  let pass = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return passes[pass++] ?? sse([text("…")]);
    }),
  );
}

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const piece of stream) out += piece;
  return out;
}

beforeEach(() => {
  process.env.HOLOVANT_LLM_API_KEY = "test";
  started.length = 0;
  finished.length = 0;
  requests = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HOLOVANT_LLM_API_KEY;
});

describe("two lookups asked for at once", () => {
  it("runs them together, not one after the other", async () => {
    fakeModel([
      sse([toolCall(0, "a", "weather"), toolCall(1, "b", "rates")]),
      sse([text("Готово.")]),
    ]);
    const began = Date.now();
    await collect(streamChat([{ role: "user", content: "погода и курс" }], { tools: [] }));
    const took = Date.now() - began;

    expect(started).toEqual(["weather", "rates"]);
    // Two 60 ms lookups: about 60 together, about 120 in a row.
    expect(took).toBeLessThan(110);
  });

  it("hands the results back in the order the model asked for them", async () => {
    fakeModel([
      sse([toolCall(0, "a", "weather"), toolCall(1, "b", "rates")]),
      sse([text("Готово.")]),
    ]);
    await collect(streamChat([{ role: "user", content: "погода и курс" }], { tools: [] }));

    const second = requests[1].messages;
    const tools = second.filter((m) => m.role === "tool");
    expect(tools.map((m) => m.tool_call_id)).toEqual(["a", "b"]);
    expect(String(tools[0].content)).toContain("weather result");
    expect(String(tools[1].content)).toContain("rates result");
  });

  it("still answers when one of them fails", async () => {
    fakeModel([
      sse([toolCall(0, "a", "broken"), toolCall(1, "b", "rates")]),
      sse([text("Курс нашёл, погоду нет.")]),
    ]);
    const said = await collect(
      streamChat([{ role: "user", content: "погода и курс" }], { tools: [] }),
    );
    expect(said).toContain("Курс нашёл");
    const tools = requests[1].messages.filter((m) => m.role === "tool");
    expect(String(tools[0].content)).toContain("That lookup failed");
  });
});

describe("a preamble followed by a tool call", () => {
  it("still runs the tool — the rule that was once written the other way", async () => {
    // "я проверю свежие новости", then nothing: the turn used to end at the
    // text, having promised to check and never checked.
    fakeModel([
      sse([text("Сейчас проверю. "), toolCall(0, "a", "web_search")]),
      sse([text("Нашёл.")]),
    ]);
    const said = await collect(
      streamChat([{ role: "user", content: "что нового" }], { tools: [] }),
    );
    expect(started).toEqual(["web_search"]);
    expect(said).toContain("Сейчас проверю.");
    expect(said).toContain("Нашёл.");
  });
});
