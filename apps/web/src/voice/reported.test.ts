import { describe, expect, it } from "vitest";
import { matchIntent } from "./commandEngine";
import { looksLikeFailedCommand } from "./failedCommand";
import { isStopCommand, withoutStopWords } from "./stopWords";

/**
 * Every line here is something the founder reported as not working, written
 * the way he said it. He has twice been told a thing was fixed when it was
 * not; these are so that claim can be checked rather than trusted.
 */
describe("reported broken — switching modules while music plays", () => {
  it("opens a module instead of hunting for a track by that name", () => {
    // This went to YouTube, played a video about Instagram, and never opened
    // the module — which from across the room is no reaction at all.
    expect(matchIntent("включи Instagram")).toMatchObject({
      kind: "open",
      moduleId: "instagram",
    });
    expect(matchIntent("переключись на инстаграм")).toMatchObject({
      kind: "open",
      moduleId: "instagram",
    });
    expect(matchIntent("включи погоду")).toMatchObject({ kind: "open", moduleId: "weather" });
    expect(matchIntent("поставь новости")).toMatchObject({ kind: "open", moduleId: "news" });
  });

  it("still plays a track that merely sounds like a name", () => {
    expect(matchIntent("включи Radiohead")).toMatchObject({ kind: "play", query: "radiohead" });
    expect(matchIntent("включи музыку")).toMatchObject({ kind: "play", query: "" });
  });
});

describe("reported broken — the saved collection", () => {
  it("finds the favourites however he phrases it", () => {
    for (const said of [
      "включи мою любимую музыку",
      "моя любимая музыка",
      "включи мои любимые треки",
      "поставь мою музыку",
      "включи избранное",
      "play my favourite music",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "favoritePlay" });
    }
  });

  it("still saves what is playing", () => {
    expect(matchIntent("запомни этот трек")).toMatchObject({ kind: "favoriteAdd" });
    expect(matchIntent("сохрани в избранное")).toMatchObject({ kind: "favoriteAdd" });
  });
});

describe("reported broken — transport control", () => {
  it("pauses and resumes rather than closing the player", () => {
    expect(matchIntent("пауза")).toMatchObject({ kind: "pause" });
    expect(matchIntent("поставь на паузу")).toMatchObject({ kind: "pause" });
    expect(matchIntent("продолжай")).toMatchObject({ kind: "resume" });
    expect(matchIntent("включи дальше")).toMatchObject({ kind: "resume" });
    expect(matchIntent("следующий трек")).toMatchObject({ kind: "next" });
  });
});

describe("reported broken — volume", () => {
  it("hears it however he says it", () => {
    for (const said of ["громче", "сделай громче", "погромче", "прибавь звук"]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "volume", direction: "up" });
    }
    for (const said of ["тише", "сделай тише", "потише", "убавь звук"]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "volume", direction: "down" });
    }
  });
});

describe("the assistant answers to its new name", () => {
  it("wakes on Thor", () => {
    expect(matchIntent("Тор")).toMatchObject({ kind: "wake" });
    expect(matchIntent("thor")).toMatchObject({ kind: "wake" });
    expect(matchIntent("тхор")).toMatchObject({ kind: "wake" });
  });

  it("takes a command with the name in front", () => {
    expect(matchIntent("тор включи инстаграм")).toMatchObject({ kind: "open" });
    expect(matchIntent("тор сделай громче")).toMatchObject({ kind: "volume" });
  });
});

/**
 * Commands whose subject is not music must survive music playing.
 *
 * A shortcut that stopped the player on any short phrase containing a stop
 * word claimed these: "убери лицо" turned the music off and left the face
 * exactly where it was. Whether the shortcut still overreaches cannot be seen
 * from the matcher alone, so what is checked here is that each of these does
 * resolve to a command — the shortcut now defers to any command that matches.
 */
describe("a command about something else, while music plays", () => {
  it("still resolves to its own intent", () => {
    expect(matchIntent("убери лицо")).toMatchObject({ kind: "showFace", show: false });
    expect(matchIntent("закрой лицо")).toMatchObject({ kind: "showFace", show: false });
    expect(matchIntent("убери чат")).toMatchObject({ kind: "dismiss", target: "chat" });
    expect(matchIntent("закрой чат")).toMatchObject({ kind: "dismiss", target: "chat" });
    expect(matchIntent("открой погоду")).toMatchObject({ kind: "open", moduleId: "weather" });
  });

  it("still lets a music order be a music order", () => {
    expect(matchIntent("выключи музыку")).toMatchObject({ kind: "dismiss", target: "player" });
    expect(matchIntent("убери плеер")).toMatchObject({ kind: "dismiss", target: "player" });
    expect(matchIntent("пауза")).toMatchObject({ kind: "pause" });
  });
});

describe("reported broken — «Стоп! Остановись!» and it keeps reading", () => {
  /**
   * His words: "я когда говорю команду «Стоп! Остановись!», он не
   * останавливается, он дальше читает, он просто читает".
   *
   * Two faults could produce that and they have opposite cures: the word
   * never reaches the recogniser over the assistant's own voice, or it
   * reaches it and is dropped. This half rules out the second — whether the
   * words are recognised at all is answered here in a millisecond instead of
   * by talking to a machine and guessing.
   */
  it("hears both of the words he actually used, punctuation and all", () => {
    expect(isStopCommand("Стоп! Остановись!")).toBe(true);
    expect(isStopCommand("стоп")).toBe(true);
    expect(isStopCommand("остановись")).toBe(true);
    expect(isStopCommand("СТОП")).toBe(true);
  });

  it("hears it inside a sentence, not only said alone", () => {
    // Nobody says a bare word into a machine that is talking over them.
    expect(isStopCommand("да стоп же")).toBe(true);
    expect(isStopCommand("так, остановись пожалуйста")).toBe(true);
    expect(isStopCommand("Тор, хватит")).toBe(true);
  });

  it("does not stop on a word that merely contains one", () => {
    // "Остановка" is a bus stop, and a whole-word match is what keeps it from
    // silencing him mid-sentence. The other direction of the same rule.
    expect(isStopCommand("остановка автобуса")).toBe(false);
    expect(isStopCommand("стоматолог")).toBe(false);
    expect(isStopCommand("расскажи про Стокгольм")).toBe(false);
  });

  it("leaves «тише» to the volume, where it belongs", () => {
    // It lowers the sound; it does not mean be quiet. Treating it as a stop
    // would take away the only way to turn the voice down while it talks.
    expect(isStopCommand("тише")).toBe(false);
    expect(matchIntent("тише")).toMatchObject({ kind: "volume" });
  });
});

describe("reported broken — «привет, Тор» and nothing happens", () => {
  /**
   * His report: saying "привет, Тор" gives fifteen to thirty seconds of
   * nothing, and often no answer at all.
   *
   * The model was not the delay — a greeting comes back from it in about two
   * seconds, measured. The name was: attention was only recognised when the
   * name came first and was followed by nothing, so "привет, Тор" fell through
   * as an ordinary question. Questions carry guards a command does not — one
   * asked while the assistant is still speaking or still answering is dropped
   * in silence — and that is the "ничего не отвечает".
   */
  it("answers a greeting with the name in it, wherever the name falls", () => {
    for (const said of [
      "привет, Тор",
      "Тор, привет",
      "Тор",
      "эй, Тор",
      "здравствуй, Тор",
      "hey Thor",
      "Тор, ты тут",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "wake" });
    }
  });

  it("still lets a command with the name in front be that command", () => {
    // The other direction, and the one that breaks everything if it goes: the
    // name is how he addresses it before every order.
    expect(matchIntent("Тор, покажи лицо")).toMatchObject({ kind: "showFace", show: true });
    expect(matchIntent("Тор, открой погоду")).toMatchObject({ kind: "open", moduleId: "weather" });
    expect(matchIntent("Тор, включи музыку")).toMatchObject({ kind: "play" });
    expect(matchIntent("Тор, тише")).toMatchObject({ kind: "volume" });
  });

  it("still answers a real request instead of greeting him back", () => {
    // Neither of these is an attention call, and "да, сэр" to either would be
    // worse than the delay it replaces. Asking about the weather opens the
    // card — showing rather than telling is deliberate, and older than this.
    expect(matchIntent("Тор, какая погода")).toMatchObject({ kind: "open", moduleId: "weather" });
    expect(matchIntent("Тор, что там по рынку")).toBeNull();
  });

  it("does not wake on a greeting meant for somebody else", () => {
    // He talks to people in the room. Without the name it is not for Thor.
    expect(matchIntent("привет")).toBeNull();
    expect(matchIntent("привет всем")).toBeNull();
    expect(matchIntent("здравствуйте")).toBeNull();
  });
});

describe("reported broken — «Открой сайт Википедии» → «не понял команду»", () => {
  /**
   * His words: "Я говорю: «Открой сайт Википедии». Он мне говорит: «Не понял
   * команду». И ничего не происходит."
   *
   * A guard refuses phrases that begin like an order to the application and
   * match nothing, so a missed command never reaches the model — which once
   * announced that all music was off having done nothing at all. The list of
   * verbs was one-sided: opening and showing were on it, and those are exactly
   * what the model has hands for. It was being kept away from its own tool.
   */
  it("lets a request to open a page reach the model, which can open pages", () => {
    for (const said of [
      "открой сайт википедии",
      "открой youtube.com",
      "открой мне гугл",
      "покажи статью про аланью",
      "open the wikipedia site",
    ]) {
      expect(matchIntent(said), said).toBeNull();
      expect(looksLikeFailedCommand(said), said).toBe(false);
    }
  });

  it("still refuses a missed order about the music, which the matcher owns", () => {
    // The other direction, and the reason the guard exists: handed on, these
    // come back as "выключил" over music that is still playing.
    for (const said of ["включи ту самую", "выключи это", "останови уже", "поставь погромче"]) {
      expect(looksLikeFailedCommand(said), said).toBe(true);
    }
  });

  it("does not touch anything the matcher already understands", () => {
    // These never reach the guard at all, and must not start to.
    expect(matchIntent("открой инстаграм")).toMatchObject({ kind: "open", moduleId: "instagram" });
    expect(matchIntent("громче")).toMatchObject({ kind: "volume" });
    expect(matchIntent("включи музыку")).toMatchObject({ kind: "play" });
    expect(matchIntent("закрой")).toMatchObject({ kind: "close" });
  });

  it("leaves an ordinary question alone", () => {
    expect(looksLikeFailedCommand("что там по рынку недвижимости")).toBe(false);
    expect(looksLikeFailedCommand("сколько сейчас доллар")).toBe(false);
  });
});

describe("a module name is a prefix of half the internet", () => {
  /**
   * Found by the table above rather than reported: "открой сайт Википедии"
   * opened the AI card. Its alias is "ии", the aliases are matched as
   * substrings so they catch Russian endings, and "википед-ии" ends in one.
   * Two letters loose in a sentence match something eventually.
   */
  it("does not open a module on a syllable in the middle of another word", () => {
    expect(matchIntent("открой сайт википедии")).toBeNull();
    expect(matchIntent("расскажи про импрессионистов")).toBeNull();
  });

  it("still opens a module named with any ending he uses", () => {
    // Which is why the aliases are stems in the first place, and must stay so.
    expect(matchIntent("открой погоду")).toMatchObject({ moduleId: "weather" });
    expect(matchIntent("покажи погода")).toMatchObject({ moduleId: "weather" });
    expect(matchIntent("открой новости")).toMatchObject({ moduleId: "news" });
    expect(matchIntent("покажи акции")).toMatchObject({ moduleId: "stocks" });
    expect(matchIntent("открой второй мозг")).toMatchObject({ moduleId: "brain" });
    expect(matchIntent("открой ии")).toMatchObject({ moduleId: "ai" });
  });

  it("tells an address from a card with the same name", () => {
    // "открой ютуб" is the card. "открой youtube.com" is the site, and the
    // difference is a dot the text cleaner used to remove before anyone looked.
    expect(matchIntent("открой ютуб")).toMatchObject({ moduleId: "youtube" });
    expect(matchIntent("открой youtube.com")).toBeNull();
    expect(matchIntent("открой https://ru.wikipedia.org")).toBeNull();
  });
});

describe("reported broken — «Музыку стоп, отключи музыку» and nothing happens", () => {
  /**
   * His words: he asked for his favourite song, got it, then said "Музыку
   * стоп, отключи музыку" and nothing happened.
   *
   * Nothing is not quite what happened. Three of the six ways he says it
   * opened the Music card instead, while the song carried on — a short phrase
   * naming a module is read as "open it", and the order standing beside the
   * name was not looked at. "отключи" was missing from the list of orders
   * entirely. Two of six working is worse than none: it reads as the machine
   * being moody rather than as a missing word.
   */
  it("stops the music every way he has said it", () => {
    for (const said of [
      "музыку стоп",
      "отключи музыку",
      "выключи музыку",
      "останови музыку",
      "стоп музыка",
      "выруби музыку",
      "убери музыку",
      "заглуши музыку",
    ]) {
      expect(matchIntent(said), said).toMatchObject({ kind: "dismiss", target: "player" });
    }
  });

  it("still opens the card when that is what was asked", () => {
    // The other direction: the name is still a heading when nothing orders it
    // off, and an explicit "открой" always wins.
    expect(matchIntent("открой музыку")).toMatchObject({ kind: "open", moduleId: "music" });
    expect(matchIntent("покажи музыку")).toMatchObject({ kind: "open", moduleId: "music" });
    expect(matchIntent("инстаграм")).toMatchObject({ kind: "open", moduleId: "instagram" });
  });

  it("keeps an order about one thing away from another", () => {
    // "убери лицо" once stopped the music and left the face exactly where it
    // was. It must stay named-thing-first.
    expect(matchIntent("убери лицо")).toMatchObject({ kind: "showFace", show: false });
    expect(matchIntent("закрой чат")).toMatchObject({ kind: "dismiss", target: "chat" });
  });
});

describe("reported broken - two orders in one breath", () => {
  /**
   * His words: the command "стоп и закрой лицо" did not work. Half of it did.
   * Stopping is checked before anything else, so that a long answer is cut the
   * instant the word is heard - and it returned there, with the rest of the
   * sentence never read. The voice stopped and the face stayed up.
   */
  it("keeps the order that was left after the stop", () => {
    expect(withoutStopWords("стоп и закрой лицо")).toBe("закрой лицо");
    expect(withoutStopWords("стоп, закрой лицо")).toBe("закрой лицо");
    expect(withoutStopWords("остановись и убери лицо")).toBe("убери лицо");
    expect(withoutStopWords("стоп а потом выключи музыку")).toBe("выключи музыку");
  });

  it("still recognises what is left as the command it is", () => {
    expect(matchIntent(withoutStopWords("стоп и закрой лицо"))).toMatchObject({
      kind: "showFace",
      show: false,
    });
    expect(matchIntent(withoutStopWords("стоп, выключи музыку"))).toMatchObject({
      kind: "dismiss",
      target: "player",
    });
  });

  it("leaves nothing behind when stopping was the whole of it", () => {
    // The ordinary case, and it must stay ordinary: bare "стоп" is silence and
    // nothing else. Anything left over here would be run as a second command.
    for (const said of ["стоп", "остановись", "хватит", "стоп стоп"]) {
      expect(withoutStopWords(said), said).toBe("");
    }
  });

  it("does not treat a question after the stop as a command", () => {
    // "Стоп" means be quiet. Whatever follows is only obeyed when it is a
    // recognised order - handing the remainder to the model would have it
    // answer back, which is the opposite of what was asked.
    const rest = withoutStopWords("стоп, что там по рынку недвижимости");
    expect(rest).not.toBe("");
    expect(matchIntent(rest)).toBeNull();
  });

  it("does not send an ordinary order down the stop path at all", () => {
    // The direction this has broken in before: "убери лицо" once stopped the
    // music and left the face where it was. "Убери" is deliberately not a word
    // that stops the voice, so this never reaches the branch above.
    expect(isStopCommand("убери лицо")).toBe(false);
    expect(matchIntent("убери лицо")).toMatchObject({ kind: "showFace", show: false });
  });
});
