import type { ModuleDefinition } from "@holovant/module-contracts";
import type { CardsFootball } from "@/app/api/cards/route";
import { createCardProvider } from "@/lib/createCardProvider";
import { pluralRu } from "@/voice/russianNumbers";

/**
 * The Süper Lig, and the European nights the Istanbul clubs play in.
 *
 * This card used to read "Arsenal vs Man City, 1 - 1" — a match nobody was
 * playing, in a league he does not follow. He asked for the Turkish teams, the
 * cups and the Champions League, and asked for them shown rather than read
 * out, so the spoken line is one sentence and everything else is on the card.
 */
export type SportsSnapshot = CardsFootball;

const UNKNOWN = "—";

/**
 * The Turkish clubs by their Russian names, for the one line that is spoken.
 * The card itself shows what the scoreboard shows, which is the Latin name and
 * what he sees on television here.
 *
 * A club not on this list is said as it is written. That is a mumble, and it
 * is still better than a transliteration invented on the spot.
 */
const SAID_IN_RUSSIAN: Record<string, string> = {
  Galatasaray: "Галатасарай",
  Fenerbahçe: "Фенербахче",
  Beşiktaş: "Бешикташ",
  Trabzonspor: "Трабзонспор",
  Başakşehir: "Башакшехир",
  Alanyaspor: "Аланьяспор",
  Antalyaspor: "Анталияспор",
  Konyaspor: "Коньяспор",
  Kayserispor: "Кайсериспор",
  Samsunspor: "Самсунспор",
  Kocaelispor: "Коджаэлиспор",
  Göztepe: "Гёзтепе",
  Gaziantep: "Газиантеп",
  Rizespor: "Ризеспор",
  Eyüpspor: "Эюпспор",
  Kasımpaşa: "Касымпаша",
  Gençlerbirliği: "Генчлербирлиги",
  Amed: "Амед",
};

function spoken(team: string): string {
  return SAID_IN_RUSSIAN[team] ?? team;
}

/** "17:00" from the source's timestamp, or nothing when it gave no time. */
function kickoff(at: string | null): string | null {
  if (!at) return null;
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return null;
  const today = new Date();
  const sameDay =
    when.getFullYear() === today.getFullYear() &&
    when.getMonth() === today.getMonth() &&
    when.getDate() === today.getDate();
  const time = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `сегодня ${time}`;
  return `${when.getDate()}.${String(when.getMonth() + 1).padStart(2, "0")} ${time}`;
}

export const sportsModule: ModuleDefinition<SportsSnapshot> = {
  id: "sports",
  label: "Sports",
  tagline: "Süper Lig",
  themeColor: "#5cabe9",
  dataProvider: createCardProvider<SportsSnapshot>("football", {
    state: "unreachable",
    season: null,
    table: [],
    partial: false,
    next: [],
    last: null,
  }),
  toMetrics: (d) => {
    if (d.state === "unreachable" || d.table.length === 0) {
      return [
        { label: "Суперлига", value: "не удалось получить" },
        { label: "Ближайший матч", value: UNKNOWN },
      ];
    }

    // The heading says what the rows are, because on the free tier they are
    // the top of the table and not the table.
    const heading = d.partial ? `Суперлига, первые ${d.table.length}` : "Суперлига";
    const rows = d.table.map((row) => ({
      label: `${row.rank}. ${row.team}`,
      // Both nouns agree with their own number: "10 очков · 4 игры",
      // "1 очко · 1 игра". A fixed label is right for one value in three.
      value:
        `${row.points} ${pluralRu(row.points, ["очко", "очка", "очков"])}` +
        ` · ${row.played} ${pluralRu(row.played, ["игра", "игры", "игр"])}` +
        `${row.form ? ` · ${row.form}` : ""}`,
    }));

    const [next] = d.next;
    const nextLine = next
      ? `${next.title}${kickoff(next.at) ? `, ${kickoff(next.at)}` : ""}`
      : "нет в расписании";

    return [
      { label: heading, value: d.season ?? UNKNOWN },
      ...rows,
      { label: "Ближайший матч", value: nextLine },
      ...(d.last?.score
        ? [{ label: "Последний результат", value: `${d.last.title} — ${d.last.score}` }]
        : []),
    ];
  },
  toAdvice: (d, lang) => {
    if (d.state === "unreachable" || d.table.length === 0) {
      const tips =
        lang === "ru"
          ? ["Таблицу сейчас не достать", "Источник не отвечает — попробуйте позже"]
          : ["The table is not reachable", "The source is not answering — try later"];
      return { spoken: tips[0], tips };
    }

    const leader = d.table[0];
    // The European fixture is the one worth a sentence: the league is on the
    // card, and a Champions League night is not.
    const europe = d.next.find((fixture) => /Champions|Europa|Conference/i.test(fixture.competition));
    const [next] = d.next;

    const tips =
      lang === "ru"
        ? [
            // No preposition in front of the second number on purpose:
            // "после 4 туров" is spoken "после четыре туров" — forVoice only
            // declines after the prepositions it knows, and "после" is not one.
            `${spoken(leader.team)} первый: ${leader.points} ${pluralRu(leader.points, ["очко", "очка", "очков"])}` +
              `, ${leader.played} ${pluralRu(leader.played, ["игра", "игры", "игр"])}`,
            next ? `Ближайший матч — ${next.title}${kickoff(next.at) ? `, ${kickoff(next.at)}` : ""}` : "В расписании пока пусто",
            europe ? `В Европе: ${europe.title}` : "Европейских матчей в ближайшие дни нет",
          ]
        : [
            `${leader.team} lead on ${leader.points} points from ${leader.played}`,
            next ? `Next: ${next.title}` : "Nothing scheduled yet",
            europe ? `In Europe: ${europe.title}` : "No European fixture in the next few days",
          ];
    // One sentence, because he asked for this one shown rather than read out.
    return { spoken: tips[0], tips };
  },
};
