/**
 * Why a request to the server failed, in words he can act on.
 *
 * Everything that was not a 501 used to end in the same sentence — "Не смог
 * получить ответ" — and that sentence cost a fortnight. The perimeter was
 * refusing every POST the page made because the app had been opened at one of
 * its two addresses rather than the other, and the assistant said only that it
 * could not answer. Questions failed, music failed, nothing was remembered,
 * and all three looked like the same vague fault, which is to say like no
 * fault at all.
 *
 * A refusal that cannot be told from a timeout is a refusal nobody fixes.
 */

export type FailureLang = "ru" | "en";

/**
 * @param status the HTTP status, or null when the request never arrived —
 *   the server down, the network gone, the fetch aborted for a real reason
 */
export function failureMessage(status: number | null, lang: FailureLang): string {
  const ru = lang === "ru";

  switch (status) {
    case 501:
      return ru
        ? "Языковая модель не подключена — нужен ключ."
        : "No language model is connected — a key is needed.";
    case 403:
      // The perimeter, refusing the page it is supposed to serve. Naming the
      // address is the whole point: it is the one thing that fixes it.
      return ru
        ? "Запрос отклонён заслоном. Откройте страницу по адресу http://localhost:3000"
        : "Refused by the perimeter. Open the page at http://localhost:3000";
    case 401:
      return ru
        ? "Нужен токен доступа — он задан на сервере, а страница его не прислала."
        : "An access token is required and the page did not send one.";
    case 429:
      return ru
        ? "Слишком много запросов подряд — подождите минуту."
        : "Too many requests — wait a minute.";
    case 400:
      return ru ? "Сервер не понял запрос." : "The server could not read the request.";
    default:
      break;
  }

  if (status === null) {
    return ru
      ? "Сервер не отвечает — похоже, он не запущен."
      : "The server is not answering — it looks like it is not running.";
  }

  // An unexpected status still says which one, because "не смог" says nothing
  // and a number can be repeated back to whoever can fix it.
  return ru ? `Сервер ответил ошибкой ${status}.` : `The server answered with ${status}.`;
}
