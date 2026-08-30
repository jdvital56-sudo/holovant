import { describe, expect, it } from "vitest";
import { matchIntent } from "@/voice/commandEngine";

/** Every spoken line in the demonstration script, checked before he says it. */
const SCRIPT: Array<[said: string, expected: string]> = [
  ["Тор", "wake"],
  ["Тор, покажи своё лицо", "showFace"],
  ["закрой лицо", "showFace"],
  ["открой погоду", "open"],
  ["открой систему", "open"],
  ["открой второй мозг", "open"],
  ["открой инстаграм", "open"],
  ["включи инстаграм", "open"],
  ["включи музыку", "play"],
  ["включи музыку Скриптонит", "play"],
  ["пауза", "pause"],
  ["продолжай", "resume"],
  ["следующий трек", "next"],
  ["сохрани в подборку для работы", "favoriteAdd"],
  ["включи подборку для работы", "favoritePlay"],
  ["включи мою любимую музыку", "favoritePlay"],
  ["какие у меня подборки", "playlistList"],
  ["выключи музыку", "dismiss"],
  ["сделай громче", "volume"],
  ["сделай тише", "volume"],
  ["убери чат", "dismiss"],
  ["убери всё", "dismiss"],
  ["найди в интернете курс биткоина", "search"],
  ["влево", "rotate"],
  ["вправо", "rotate"],
];

describe("the demonstration script", () => {
  for (const [said, expected] of SCRIPT) {
    it(`“${said}” → ${expected}`, () => {
      const intent = matchIntent(said);
      expect(intent, said).not.toBeNull();
      expect(intent?.kind, said).toBe(expected);
    });
  }
});
