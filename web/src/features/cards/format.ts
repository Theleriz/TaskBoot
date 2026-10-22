const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const round = (n: number) => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));
const num = (n: number) => String(round(n)).replace('.', ',');

/** A short interval for the answer buttons: "1 мин", "6 ч", "4 дн", "2,5 мес", "1,2 г". */
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} мин`;
  if (ms < DAY) return `${num(ms / HOUR)} ч`;
  if (ms < 30 * DAY) return `${Math.round(ms / DAY)} дн`;
  if (ms < 365 * DAY) return `${num(ms / (30 * DAY))} мес`;
  return `${num(ms / (365 * DAY))} г`;
}

/** When a review item is due, relative to now: "сейчас", "через 3 дн". */
export function formatDue(due: number, now: number): string {
  return due <= now ? 'сейчас' : `через ${formatInterval(due - now)}`;
}

/** The first meaningful line of Markdown, without gap markup, for card lists. */
export function cardSummary(text: string): string {
  const plain = text.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '[$1]');
  return (
    plain
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ?? ''
  );
}
