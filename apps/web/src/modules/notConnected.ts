import type { ModuleDefinition, ModuleId } from "@holovant/module-contracts";

/**
 * A card for a service that is not connected, which says so.
 *
 * Six cards in the ring — Instagram, TikTok, YouTube, X, LinkedIn, Telegram —
 * showed accounts that do not exist (@holovant.studio with 12.4K followers)
 * and gave advice on them: "рост 5.8% в неделю — вкладывайтесь сюда". An
 * invented number is bad; confident advice drawn from one is worse, because
 * it reads as analysis. The review before sale ranked this above any
 * technical fault: one buyer who notices fake data stops trusting the rest.
 *
 * Each of these needs the owner's own account and a developer key to be real,
 * and those are his to create and enter. Until then the card says it is not
 * connected and what connecting it takes.
 */

export interface NotConnectedSnapshot {
  state: "not-connected";
}

export interface NotConnectedCard {
  id: ModuleId;
  label: string;
  themeColor: string;
  /** What connecting it takes, in the words he would act on. */
  needs: { ru: string; en: string };
}

export function createNotConnectedModule(card: NotConnectedCard): ModuleDefinition<NotConnectedSnapshot> {
  return {
    id: card.id,
    label: card.label,
    tagline: "не подключено",
    themeColor: card.themeColor,
    dataProvider: {
      getSnapshot: () => ({ state: "not-connected" }),
    },
    // A dash as the figure and the state underneath it, the way every other
    // card shows something it does not know. "НЕ ПОДКЛЮЧЁН" as the figure
    // itself, in the largest type on the card, was honest and was also the
    // first thing anyone saw on six cards of sixteen.
    toMetrics: () => [
      { label: "не подключено", value: "—" },
      { label: "Нужно", value: card.needs.ru },
    ],
    toAdvice: (_data, lang) => {
      const tips =
        lang === "ru"
          ? [`${card.label} не подключён`, `Чтобы подключить: ${card.needs.ru}`]
          : [`${card.label} is not connected`, `To connect it: ${card.needs.en}`];
      // One sentence out loud. It is not news, and he asked for less talking.
      return { spoken: tips[0], tips };
    },
  };
}
