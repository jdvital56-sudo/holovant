import { describe, expect, it } from "vitest";
import {
  createMultiAccountProvider,
  maxBy,
  sumBy,
  weightedAverage,
} from "./createMultiAccountProvider";

interface Social {
  followers: number;
  growthPct: number;
  bestPost: number;
}

const accounts = [
  { id: "big", label: "@big", data: { followers: 90000, growthPct: 1, bestPost: 300000 } },
  { id: "small", label: "@small", data: { followers: 10000, growthPct: 41, bestPost: 20000 } },
];

describe("combining several accounts", () => {
  it("adds up audience", () => {
    expect(sumBy(accounts, (d: Social) => d.followers)).toBe(100000);
  });

  it("weights a growth rate by audience rather than averaging it flat", () => {
    // The flat mean is 21%, which would claim the whole audience is growing
    // fast because one tiny account is. Weighted, it is 5%.
    const weighted = weightedAverage(
      accounts,
      (d: Social) => d.growthPct,
      (d: Social) => d.followers,
    );
    expect(weighted).toBeCloseTo(5, 5);
    expect(weighted).not.toBeCloseTo(21, 0);
  });

  it("takes the largest single peak, never a total", () => {
    // A best post is one post: 300k and 20k do not make a 320k post.
    expect(maxBy(accounts, (d: Social) => d.bestPost)).toBe(300000);
  });

  it("reports zero growth rather than dividing by zero when there is no audience", () => {
    const empty = [{ id: "new", label: "@new", data: { followers: 0, growthPct: 12, bestPost: 0 } }];
    expect(weightedAverage(empty, (d: Social) => d.growthPct, (d: Social) => d.followers)).toBe(0);
  });
});

describe("the provider it builds", () => {
  const provider = createMultiAccountProvider<Social>({
    accounts,
    aggregate: (all) => ({
      followers: sumBy(all, (d) => d.followers),
      growthPct: weightedAverage(all, (d) => d.growthPct, (d) => d.followers),
      bestPost: maxBy(all, (d) => d.bestPost),
    }),
  });

  it("reports the combined position as its snapshot", () => {
    expect(provider.getSnapshot()).toMatchObject({ followers: 100000, bestPost: 300000 });
  });

  it("lists the accounts behind it, so one can be looked at alone", async () => {
    // Awaited because the contract allows a provider to fetch them, which a
    // live one will.
    const listed = await provider.listAccounts?.();
    expect(listed).toHaveLength(2);
    expect(listed?.[1]).toMatchObject({ id: "small", label: "@small" });
  });
});
