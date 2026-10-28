import type { DeckCounts } from './queue.ts';

/** New / learning / review counts, colored like in Anki. */
export function DeckCountsBadges({ counts }: { counts: DeckCounts }) {
  return (
    <span className="deck-counts">
      <span className="dc new" title="Новые на сегодня">
        {counts.new}
      </span>
      <span className="dc learning" title="На изучении">
        {counts.learning}
      </span>
      <span className="dc review" title="К повторению сегодня">
        {counts.review}
      </span>
    </span>
  );
}
