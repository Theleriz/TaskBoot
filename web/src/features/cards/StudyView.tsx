import { Suspense, lazy, useEffect, useState } from 'react';
import { BASIC_SLOT, type CardRating } from '../../data/model.ts';
import { previewDue } from '../../data/scheduler.ts';
import { useAppData } from '../../state/hooks.ts';
import { answerCard } from '../../state/ops.ts';
import { formatInterval } from './format.ts';
import { type DeckScope, deckCounts, nextDue, nextItem } from './queue.ts';
import { DeckCountsBadges } from './DeckCountsBadges.tsx';

const NotePreview = lazy(() => import('../knowledge/NotePreview.tsx'));

const ANSWERS: { rating: CardRating; title: string; className: string }[] = [
  { rating: 1, title: 'Снова', className: 'again' },
  { rating: 2, title: 'Трудно', className: 'hard' },
  { rating: 3, title: 'Хорошо', className: 'good' },
  { rating: 4, title: 'Легко', className: 'easy' },
];

/** Refresh "now" so learning items come back on time while the screen stays open. */
const TICK_MS = 15_000;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')
  );
}

export function StudyView({
  scope,
  title,
  onExit,
  onOpenNote,
}: {
  scope: DeckScope;
  title: string;
  onExit: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const { data, apply, load } = useAppData();
  const readOnly = load.kind === 'ready' && load.readOnly;
  const [now, setNow] = useState(() => Date.now());
  // The item whose answer is shown: "cardId/slot/reps", so a new item starts hidden.
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const item = nextItem(data, scope, now);
  const key = item ? `${item.card.id}/${item.slot}/${item.schedule.reps}` : null;
  const shown = key !== null && revealed === key;
  const counts = deckCounts(data, scope, now);

  const answer = (rating: CardRating) => {
    if (!item || !shown || readOnly) return;
    const at = Date.now();
    apply((d) => answerCard(d, item.card.id, item.slot, rating, at));
    setNow(at);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter') && key) {
        e.preventDefault();
        setRevealed(key);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        answer(Number(e.key) as CardRating);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const note = item?.card.noteId ? data.notes.find((n) => n.id === item.card.noteId) : undefined;
  const preview = item && shown ? previewDue(item.schedule, now) : null;
  const upcoming = item ? null : nextDue(data, scope);

  return (
    <section className="box study" aria-label={`Повторение: ${title}`}>
      <div className="study-head">
        <button type="button" className="btn small" onClick={onExit}>
          ← Назад
        </button>
        <h2>{title}</h2>
        <span className="spacer" />
        <DeckCountsBadges counts={counts} />
      </div>

      {!item ? (
        <div className="study-done" role="status">
          <p className="study-done-title">На сегодня всё</p>
          <p className="muted">
            {upcoming === null
              ? 'В этой колоде нет карточек к повторению.'
              : `Следующая карточка — через ${formatInterval(Math.max(upcoming - now, 60_000))}.`}
          </p>
        </div>
      ) : (
        <>
          <Suspense fallback={<div className="note-loading">Загрузка…</div>}>
            <div className="study-card" aria-live="polite">
              <NotePreview
                text={item.card.front}
                cloze={item.slot === BASIC_SLOT ? undefined : { slot: item.slot, reveal: shown }}
                className="study-face"
              />
              {shown && item.card.back.trim() && (
                <>
                  <hr className="study-divider" />
                  <NotePreview text={item.card.back} className="study-face" />
                </>
              )}
            </div>
          </Suspense>

          {note && (
            <button
              type="button"
              className="btn small study-source"
              onClick={() => onOpenNote(note.id)}
            >
              Заметка: {note.title}
            </button>
          )}

          {!shown ? (
            <div className="study-actions">
              <button
                type="button"
                className="btn primary study-show"
                onClick={() => key && setRevealed(key)}
              >
                Показать ответ
              </button>
              <span className="hint">Пробел или Enter</span>
            </div>
          ) : (
            <div className="study-actions" role="group" aria-label="Насколько легко вспомнили">
              {ANSWERS.map((a) => (
                <button
                  key={a.rating}
                  type="button"
                  className={`btn answer ${a.className}`}
                  disabled={readOnly}
                  onClick={() => answer(a.rating)}
                >
                  <span className="answer-title">
                    {a.rating}. {a.title}
                  </span>
                  {preview && (
                    <span className="answer-when">{formatInterval(preview[a.rating] - now)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
