import { describe, expect, it } from "vitest";
import {
  formInRussian,
  mergeFixtures,
  parseFixture,
  parseFixtures,
  parseTable,
  seasonFor,
} from "./football";

/**
 * The rows here are copied out of what the source actually returned on
 * 2026-09-07, not written from what its documentation says it returns. Every
 * number arrives as a string, several fields are null before a match is
 * played, and the free tier sends five rows where a league has eighteen —
 * none of which is visible from the docs.
 */

const REAL_TABLE = {
  table: [
    {
      intRank: "1",
      strTeam: "Galatasaray",
      intPlayed: "4",
      intWin: "3",
      intPoints: "10",
      intGoalDifference: "6",
      strForm: "WWWD",
      strDescription: "Promotion - Champions League (League phase)",
    },
    {
      intRank: "2",
      strTeam: "Beşiktaş",
      intPlayed: "4",
      intPoints: "9",
      intGoalDifference: "5",
      strForm: "WWLW",
    },
    {
      intRank: "4",
      strTeam: "Fenerbahçe",
      intPlayed: "4",
      intPoints: "6",
      intGoalDifference: "2",
      strForm: "LWWL",
    },
    {
      intRank: "3",
      strTeam: "Gençlerbirliği",
      intPlayed: "3",
      intPoints: "7",
      intGoalDifference: "2",
      strForm: "DWW",
    },
  ],
};

const REAL_UPCOMING = {
  events: [
    {
      strEvent: "Göztepe vs Gaziantep",
      strHomeTeam: "Göztepe",
      strAwayTeam: "Gaziantep",
      strLeague: "Turkish Super Lig",
      strTimestamp: "2026-09-07T17:00:00",
      dateEvent: "2026-09-07",
      intHomeScore: null,
      intAwayScore: null,
    },
  ],
};

const REAL_PLAYED = {
  events: [
    {
      strEvent: "Kocaelispor vs Samsunspor",
      strHomeTeam: "Kocaelispor",
      strAwayTeam: "Samsunspor",
      strLeague: "Turkish Super Lig",
      strTimestamp: "2026-09-06T17:00:00",
      intHomeScore: "1",
      intAwayScore: "0",
    },
  ],
};

const REAL_EUROPE = {
  events: [
    {
      strEvent: "Sporting CP vs Galatasaray",
      strHomeTeam: "Sporting CP",
      strAwayTeam: "Galatasaray",
      strLeague: "UEFA Champions League",
      strTimestamp: "2026-09-09T19:00:00",
      intHomeScore: null,
      intAwayScore: null,
    },
  ],
};

describe("the league table", () => {
  it("reads the real reply, numbers and all", () => {
    const rows = parseTable(REAL_TABLE);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      rank: 1,
      team: "Galatasaray",
      played: 4,
      points: 10,
      goalDifference: 6,
      form: "ВВВН",
    });
  });

  it("puts the rows in the order of the table, not the order they arrived", () => {
    // The fourth row of the fixture above is rank 3. Position is the whole
    // point of a table.
    expect(parseTable(REAL_TABLE).map((row) => row.rank)).toEqual([1, 2, 3, 4]);
  });

  it("drops a row with no name rather than showing a nameless club", () => {
    const rows = parseTable({ table: [{ intRank: "5" }, { strTeam: "Amed" }] });
    expect(rows).toEqual([]);
  });

  it("returns nothing at all when the source sent something else", () => {
    // Each of these has happened to one source or another in this codebase.
    for (const payload of [null, undefined, {}, { table: null }, { table: "нет" }, []]) {
      expect(parseTable(payload)).toEqual([]);
    }
  });
});

describe("form", () => {
  it("says В, Н and П", () => {
    expect(formInRussian("WWWD")).toBe("ВВВН");
    expect(formInRussian("LWWL")).toBe("ПВВП");
  });

  it("has nothing to say when the source sent nothing", () => {
    // A club that has not played is not a club on a losing run.
    expect(formInRussian("")).toBeNull();
    expect(formInRussian(null)).toBeNull();
    expect(formInRussian(undefined)).toBeNull();
    expect(formInRussian("???")).toBeNull();
  });
});

describe("a fixture", () => {
  it("joins the two clubs the way the card writes them", () => {
    expect(parseFixture(REAL_UPCOMING.events[0])).toEqual({
      title: "Göztepe — Gaziantep",
      competition: "Turkish Super Lig",
      at: "2026-09-07T17:00:00",
      score: null,
    });
  });

  it("has no score before it is played, and the real one after", () => {
    // The direction that matters: an unplayed match must not read 0:0, which
    // is a result some matches genuinely end in.
    expect(parseFixture(REAL_UPCOMING.events[0])?.score).toBeNull();
    expect(parseFixture(REAL_PLAYED.events[0])?.score).toBe("1:0");
  });

  it("does not show half a score", () => {
    const half = parseFixture({
      strHomeTeam: "Alanyaspor",
      strAwayTeam: "Konyaspor",
      intHomeScore: "2",
      intAwayScore: null,
    });
    expect(half?.score).toBeNull();
  });

  it("keeps the competition, which is how a European night shows itself", () => {
    expect(parseFixture(REAL_EUROPE.events[0])?.competition).toBe("UEFA Champions League");
  });

  it("is nothing when there are no clubs in it", () => {
    expect(parseFixture(undefined)).toBeNull();
    expect(parseFixture({})).toBeNull();
    expect(parseFixtures({ events: null })).toEqual([]);
  });
});

describe("merging the fixture lists", () => {
  it("puts the nearest match first", () => {
    const merged = mergeFixtures([parseFixtures(REAL_EUROPE), parseFixtures(REAL_UPCOMING)]);
    expect(merged.map((f) => f.title)).toEqual([
      "Göztepe — Gaziantep",
      "Sporting CP — Galatasaray",
    ]);
  });

  it("lists a match once when two endpoints both report it", () => {
    // The league's next fixture and a club's next fixture are frequently the
    // same game, arriving twice.
    const merged = mergeFixtures([parseFixtures(REAL_UPCOMING), parseFixtures(REAL_UPCOMING)]);
    expect(merged).toHaveLength(1);
  });
});

describe("the season", () => {
  it("is the one being played, not the calendar year", () => {
    // September is the start of a season; February is the middle of the one
    // that started the previous August. Reading the table of a season that
    // has not begun returns an empty league, which looks like a fault.
    expect(seasonFor(new Date("2026-09-07T12:00:00Z"))).toBe("2026-2027");
    expect(seasonFor(new Date("2027-02-14T12:00:00Z"))).toBe("2026-2027");
    expect(seasonFor(new Date("2026-05-20T12:00:00Z"))).toBe("2025-2026");
    expect(seasonFor(new Date("2026-07-02T12:00:00Z"))).toBe("2026-2027");
  });
});
