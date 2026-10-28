import { useState } from 'react';
import { newId } from '../../data/ids.ts';
import type { Flashcard } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { addCard, deleteCard, resetCard, updateCard } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { CardForm } from './CardForm.tsx';
import { DeckCountsBadges } from './DeckCountsBadges.tsx';
import { cardSummary, formatDue } from './format.ts';
import { deckCounts } from './queue.ts';

function cardDue(card: Flashcard, now: number): string {
  const schedules = Object.values(card.schedules);
  if (schedules.every((s) => s.state === 0)) return 'новая';
  const due = Math.min(...schedules.filter((s) => s.state !== 0).map((s) => s.due));
  return formatDue(due, now);
}

function CardRow({
  card,
  now,
  onOpenNote,
}: {
  card: Flashcard;
  now: number;
  onOpenNote: (noteId: string) => void;
}) {
  const { data, apply } = useAppData();
  const [editing, setEditing] = useState(false);
  const note = card.noteId ? data.notes.find((n) => n.id === card.noteId) : undefined;
  const gaps = Object.keys(card.schedules).length;

  if (editing) {
    return (
      <li className="card-edit">
        <CardForm
          initial={{ ...card, newDeck: '' }}
          decks={data.decks}
          submitLabel="Сохранить"
          onCancel={() => setEditing(false)}
          onSubmit={(draft) => {
            const at = Date.now();
            apply((d) => updateCard(d, card.id, draft, at));
            setEditing(false);
          }}
          extra={
            <>
              <span className="spacer" />
              <button
                type="button"
                className="btn danger-ghost"
                onClick={() => {
                  if (
                    !window.confirm('Начать учить эту карточку заново? Прогресс будет сброшен.')
                  ) {
                    return;
                  }
                  const at = Date.now();
                  apply((d) => resetCard(d, card.id, at));
                  setEditing(false);
                }}
              >
                Сбросить прогресс
              </button>
            </>
          }
        />
      </li>
    );
  }

  return (
    <li className="card-row">
      <button type="button" className="card-row-main" onClick={() => setEditing(true)}>
        <span className="card-kind">{card.kind === 'cloze' ? `Пропуски · ${gaps}` : 'Вопрос'}</span>
        <span className="card-front">{cardSummary(card.front)}</span>
        <span className="muted card-due">{cardDue(card, now)}</span>
      </button>
      {note && (
        <button
          type="button"
          className="btn small"
          title={`Открыть заметку «${note.title}»`}
          onClick={() => onOpenNote(note.id)}
        >
          Заметка
        </button>
      )}
      <IconButton
        icon="trash"
        label="Удалить карточку"
        danger
        onClick={() => {
          if (window.confirm('Удалить карточку вместе с историей повторений?')) {
            apply((d) => deleteCard(d, card.id));
          }
        }}
      />
    </li>
  );
}

/** One deck: its cards, a form for new ones, and the way into a study session. */
export function DeckPane({
  deckId,
  onBack,
  onStudy,
  onOpenNote,
}: {
  deckId: string;
  onBack: () => void;
  onStudy: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const { data, apply } = useAppData();
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [now] = useState(() => Date.now());
  const deck = data.decks.find((x) => x.id === deckId);
  if (!deck) return null;

  const cards = data.cards
    .filter((c) => c.deckId === deckId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const counts = deckCounts(data, deckId, now);

  return (
    <section className="box deck-pane" aria-label={`Колода «${deck.name}»`}>
      <div className="study-head">
        <button type="button" className="btn small" onClick={onBack}>
          ← Колоды
        </button>
        <h2>{deck.name}</h2>
        <span className="spacer" />
        <DeckCountsBadges counts={counts} />
        <button
          type="button"
          className="btn primary small"
          disabled={counts.new + counts.learning + counts.review === 0}
          onClick={onStudy}
        >
          Учить
        </button>
      </div>

      {adding ? (
        <CardForm
          key={formKey}
          initial={{ kind: 'basic', front: '', back: '', deckId, newDeck: '' }}
          submitLabel="Добавить и ещё одну"
          onCancel={() => setAdding(false)}
          onSubmit={(draft) => {
            const id = newId();
            const at = Date.now();
            apply((d) => addCard(d, { ...draft, deckId }, id, at));
            // A fresh form for the next card, keeping the chosen kind.
            setFormKey((k) => k + 1);
          }}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + Новая карточка
        </button>
      )}

      <ul className="list card-list">
        {cards.length === 0 && <li className="empty">пусто</li>}
        {cards.map((card) => (
          <CardRow key={card.id} card={card} now={now} onOpenNote={onOpenNote} />
        ))}
      </ul>
    </section>
  );
}
