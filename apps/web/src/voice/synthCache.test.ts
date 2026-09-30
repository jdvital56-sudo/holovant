import { describe, expect, it, vi } from "vitest";
import { createSynthCache } from "./synthCache";

/**
 * The cache behind two speed-ups: the next sentence is synthesised while the
 * current one plays, and the lines said over and over are kept ready.
 */

const audio = (label: string) => new Blob([label], { type: "audio/wav" });

describe("asking for a line", () => {
  it("makes one request when the same line is wanted twice", async () => {
    // The prefetch and the playback ask for the same sentence. Two requests
    // would put the same synthesis in the worker's queue twice and delay
    // everything behind it.
    const fetchAudio = vi.fn(async (text: string) => audio(text));
    const cache = createSynthCache(fetchAudio);
    const first = cache.get("Сорок восемь лир.");
    const second = cache.get("Сорок восемь лир.");
    expect(await first).toBe(await second);
    expect(fetchAudio).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failure, instead of handing back the same nothing", async () => {
    // The direction that would make the voice go quiet for good: a single
    // failed synthesis cached as null would be replayed as silence forever.
    let fail = true;
    const fetchAudio = vi.fn(async (text: string) => (fail ? null : audio(text)));
    const cache = createSynthCache(fetchAudio);
    expect(await cache.get("Готово.")).toBeNull();
    await Promise.resolve();
    fail = false;
    expect(await cache.get("Готово.")).not.toBeNull();
    expect(fetchAudio).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown request as a failure, not an exception", async () => {
    const cache = createSynthCache(async () => {
      throw new Error("worker stalled");
    });
    await expect(cache.get("Готово.")).resolves.toBeNull();
  });
});

describe("what is kept", () => {
  it("keeps the fixed lines when an answer is cut off", async () => {
    const fetchAudio = vi.fn(async (text: string) => audio(text));
    const cache = createSynthCache(fetchAudio);
    cache.keep("Секунду, проверяю");
    await cache.get("Секунду, проверяю");
    await cache.get("Первое предложение ответа.");
    await cache.get("Второе предложение ответа.");

    cache.dropTransient();

    expect(cache.size()).toBe(1);
    await cache.get("Секунду, проверяю");
    // Still one request for the kept line: it came from the cache.
    expect(fetchAudio.mock.calls.filter(([t]) => t === "Секунду, проверяю")).toHaveLength(1);
  });

  it("forgets a sentence once it has been played", async () => {
    const cache = createSynthCache(async (text) => audio(text));
    await cache.get("Одноразовая фраза.");
    cache.forget("Одноразовая фраза.");
    expect(cache.size()).toBe(0);
  });

  it("does not forget a kept line when asked to", async () => {
    const cache = createSynthCache(async (text) => audio(text));
    cache.keep("Не понял команду");
    await cache.get("Не понял команду");
    cache.forget("Не понял команду");
    expect(cache.size()).toBe(1);
  });

  it("stays bounded, and never makes room by dropping a kept line", async () => {
    const cache = createSynthCache(async (text) => audio(text), 3);
    cache.keep("постоянная");
    await cache.get("постоянная");
    for (let i = 0; i < 10; i++) await cache.get(`фраза ${i}`);
    expect(cache.size()).toBeLessThanOrEqual(3);
    const before = cache.size();
    await cache.get("постоянная");
    expect(cache.size()).toBe(before);
  });
});
