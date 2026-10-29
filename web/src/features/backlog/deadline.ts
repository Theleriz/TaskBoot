// Deadlines are local calendar days, "YYYY-MM-DD" — the same keys as the activity counters.

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** "1 июня 2027 г." */
export function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Whole days from `today` to `day`; negative when the day has passed. */
export function daysUntil(day: string, today: string): number {
  return Math.round((parseDay(day).getTime() - parseDay(today).getTime()) / 86_400_000);
}

/** "сегодня", "завтра", "через 5 дн.", "просрочен на 3 дн." */
export function deadlineHint(day: string, today: string): string {
  const days = daysUntil(day, today);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  return days > 0 ? `через ${days} дн.` : `просрочен на ${-days} дн.`;
}
