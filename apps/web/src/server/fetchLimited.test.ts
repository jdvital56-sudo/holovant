import { describe, expect, it } from "vitest";
import { readCapped, ResponseTooLarge } from "@/server/fetchLimited";

/**
 * A limit on how much of somebody else's answer is read into memory.
 *
 * Both directions, and the second one is where this kind of change usually
 * breaks something: the cap must stop a feed that will not stop, and must not
 * touch a normal one — his calendar is sixty kilobytes of Russian and has to
 * come back exactly as it was sent, to the byte.
 */

/** A response whose body arrives in pieces, as a real one does. */
function streamed(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  );
}

const encode = (text: string) => new TextEncoder().encode(text);

describe("what the cap must stop", () => {
  it("refuses a body bigger than the cap", () => {
    const big = streamed([new Uint8Array(1024), new Uint8Array(1024)]);
    return expect(readCapped(big, 1500)).rejects.toBeInstanceOf(ResponseTooLarge);
  });

  it("refuses it partway rather than after reading it all", async () => {
    // A feed that never ends must not be read until it does. Only the chunks
    // up to the limit are pulled; the rest is never asked for.
    let pulled = 0;
    const endless = new Response(
      new ReadableStream({
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(1024));
        },
      }),
    );
    await expect(readCapped(endless, 4096)).rejects.toBeInstanceOf(ResponseTooLarge);
    expect(pulled).toBeLessThan(20);
  });
});

describe("what the cap must not touch", () => {
  it("returns an ordinary body whole", async () => {
    const text = "BEGIN:VCALENDAR\r\nSUMMARY:Планёрка\r\nEND:VCALENDAR";
    expect(await readCapped(streamed([encode(text)]), 1_000_000)).toBe(text);
  });

  it("keeps Russian intact when a letter is split across two chunks", async () => {
    // The trap this file could easily have introduced. "Планёрка" in UTF-8 is
    // two bytes per letter; decoding each chunk on its own turns whichever
    // letter straddles the join into a replacement mark, and the calendar is
    // full of them.
    const bytes = encode("Встреча с Дубистэй в Аланье");
    const split = Math.floor(bytes.length / 2) + 1;
    const halves = [bytes.slice(0, split), bytes.slice(split)];
    expect(await readCapped(streamed(halves), 1_000_000)).toBe("Встреча с Дубистэй в Аланье");
  });

  it("allows a body exactly at the cap", async () => {
    const bytes = new Uint8Array(1000).fill(65);
    expect((await readCapped(streamed([bytes]), 1000)).length).toBe(1000);
  });

  it("reads an empty body as an empty string", async () => {
    expect(await readCapped(new Response(null), 1000)).toBe("");
    expect(await readCapped(streamed([]), 1000)).toBe("");
  });

  it("handles a real calendar's worth without complaint", async () => {
    // His own feed is 61KB across 134 entries. The cap is nowhere near it.
    const entry = "BEGIN:VEVENT\r\nSUMMARY:Встреча\r\nDTSTART:20260901T090000Z\r\nEND:VEVENT\r\n";
    const feed = entry.repeat(134);
    const read = await readCapped(streamed([encode(feed)]), 5_000_000);
    expect(read).toBe(feed);
  });
});
