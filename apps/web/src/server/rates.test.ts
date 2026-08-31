import { describe, expect, it } from "vitest";
import { buildRows, formatRate } from "@/server/rates";

/**
 * The six rates he asked for, and the two ways they can go wrong.
 *
 * A cross rate inverted the wrong way is the worst kind of bug here: it looks
 * like a perfectly reasonable number and is wrong by a factor of the rate
 * itself. Nobody notices 0,86 dollars to the euro until they act on it. So the
 * arithmetic is checked against rates a person can verify by eye.
 *
 * The other direction is a row that could not be fetched. Gold being
 * unreachable must cost gold and nothing else, and the empty row must read as
 * empty — never as zero, and never as the figure from ten minutes ago.
 */

/** Real quotes, 31 August 2026: dollars are the base, as the source gives them. */
const USD_RATES = { TRY: 48.252345, UAH: 44.546653, EUR: 0.862295 };

const valueOf = (rows: ReturnType<typeof buildRows>, id: string) => rows.find((r) => r.id === id)?.value;

describe("the arithmetic behind the rows", () => {
  it("gives the lira and the hryvnia straight from the table", () => {
    const rows = buildRows(USD_RATES, null, null);
    expect(valueOf(rows, "usd-try")).toBeCloseTo(48.25, 2);
    expect(valueOf(rows, "usd-uah")).toBeCloseTo(44.55, 2);
  });

  it("turns the euro the right way up", () => {
    // The table holds euro per dollar (0,86); the pair is quoted the other way
    // round (1,16). Printing 0,86 would be wrong and entirely plausible.
    const rows = buildRows(USD_RATES, null, null);
    expect(valueOf(rows, "eur-usd")).toBeCloseTo(1.16, 2);
    expect(valueOf(rows, "eur-usd")).toBeGreaterThan(1);
  });

  it("derives lira per euro from the two dollar rates, not from a second source", () => {
    // A euro buys more lira than a dollar does, by exactly the ratio of the
    // two. Assembling this from another provider would make the row the gap
    // between two quotes rather than a rate.
    const rows = buildRows(USD_RATES, null, null);
    expect(valueOf(rows, "eur-try")).toBeCloseTo(55.96, 1);
    expect(valueOf(rows, "eur-try")! / valueOf(rows, "usd-try")!).toBeCloseTo(1.16, 2);
  });

  it("passes metal and bitcoin through as they come", () => {
    const rows = buildRows(USD_RATES, 4434.6, 79003);
    expect(valueOf(rows, "gold")).toBe(4434.6);
    expect(valueOf(rows, "btc")).toBe(79003);
  });

  it("gives all six rows, in the order he listed them", () => {
    const rows = buildRows(USD_RATES, 4434.6, 79003);
    expect(rows.map((r) => r.id)).toEqual(["usd-try", "eur-try", "usd-uah", "eur-usd", "gold", "btc"]);
  });
});

describe("what a missing rate must not become", () => {
  it("empties only its own row when one source is down", () => {
    // Gold failing must not cost him the lira.
    const rows = buildRows(USD_RATES, null, 79003);
    expect(valueOf(rows, "gold")).toBeNull();
    expect(valueOf(rows, "usd-try")).toBeCloseTo(48.25, 2);
    expect(valueOf(rows, "btc")).toBe(79003);
  });

  it("empties every currency when the table is missing, and keeps the metals", () => {
    const rows = buildRows(null, 4434.6, 79003);
    for (const id of ["usd-try", "eur-try", "usd-uah", "eur-usd"]) expect(valueOf(rows, id), id).toBeNull();
    expect(valueOf(rows, "gold")).toBe(4434.6);
  });

  it("treats a zero or a nonsense rate as no rate at all", () => {
    // A zero divides into infinity and prints as one. It is not a rate.
    const rows = buildRows({ TRY: 0, UAH: -1, EUR: 0 }, null, null);
    for (const row of rows.slice(0, 4)) expect(row.value, row.id).toBeNull();
  });

  it("shows a dash for an empty row rather than a number", () => {
    expect(formatRate({ id: "gold", label: "Золото", value: null, unit: "$", decimals: 0 })).toBe("—");
  });
});

describe("figures a person reads", () => {
  it("keeps two places on a currency and none on a price", () => {
    const rows = buildRows(USD_RATES, 4434.6, 79003);
    expect(formatRate(rows[0])).toBe("48,25");
    // Russian groups thousands with a non-breaking space, which looks exactly
    // like an ordinary one and is a different character — so the separator is
    // named here rather than typed, or this test passes and fails by eye.
    expect(formatRate(rows.find((r) => r.id === "gold")!)).toBe(`4${String.fromCharCode(160)}435`);
  });

  it("keeps four places where the fourth is the one that moves", () => {
    // The euro against the dollar moves in the third and fourth place; two
    // would show it standing still all day.
    const rows = buildRows(USD_RATES, null, null);
    expect(formatRate(rows.find((r) => r.id === "eur-usd")!)).toBe("1,1597");
  });

  it("never prints the raw floating point tail", () => {
    const rows = buildRows(USD_RATES, 4434.600098, 79003);
    for (const row of rows) expect(formatRate(row), row.id).not.toMatch(/\d{6}/);
  });
});
