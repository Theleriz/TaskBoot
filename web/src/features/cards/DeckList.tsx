import { useState } from 'react';
import { newId } from '../../data/ids.ts';
import { NEW_CARDS_LIMITS } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { addDeck, deleteDeck, renameDeck, setNewCardsPerDay } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { DeckCountsBadges } from './DeckCountsBadges.tsx';
import { type DeckScope, deckCounts } from './queue.ts';

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

function RenameDeck({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const { apply } = useAppData();
  const [value, setValue] = useState(name);
  const save = () => {
    if (value.trim()) apply((d) => renameDeck(d, id, value));
    onDone();
  };
  return (
    <input
      className="input deck-rename"
      aria-label="Название колоды"
      maxLength={200}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone();
      }}
    />
  );
}

/** Decks with today's counts; entry point of the flashcards tab. */
export function DeckList({
  onOpen,
  onStudy,
}: {
  onOpen: (deckId: string) => void;
  onStudy: (scope: DeckScope) => void;
}) {
  const { data, apply } = useAppData();
  const [name, setName] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Counts change only on answers and edits; a minute-old "now" is fine for this list.
  const [now] = useState(() => Date.now());
  const decks = [...data.decks].sort((a, b) => collator.compare(a.name, b.name));
  const total = deckCounts(data, null, now);
  const anything = total.new + total.learning + total.review > 0;

  return (
    <section className="box decks" aria-labelledby="decksHead">
      <div className="box-head">
        <span className="stripe" style={{ background: 'var(--accent)' }} />
        <h2 id="decksHead">Колоды</h2>
        <span className="count">{data.decks.length}</span>
        <span className="spacer" />
        {decks.length > 0 && <DeckCountsBadges counts={total} />}
        <button
          type="button"
          className="btn primary small"
          disabled={!anything}
          onClick={() => onStudy(null)}
        >
          Учить все
        </button>
      </div>

      <form
        className="inline-form create"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setInvalid(true);
            return;
          }
          const id = newId();
          const at = Date.now();
          apply((d) => addDeck(d, name, id, at));
          setName('');
        }}
      >
        <input
          className={`input${invalid ? ' invalid' : ''}`}
          placeholder="Новая колода"
          aria-label="Название новой колоды"
          maxLength={200}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setInvalid(false);
          }}
        />
        <button type="submit" className="btn">
          Создать
        </button>
      </form>

      <ul className="list">
        {decks.length === 0 && (
          <li className="empty">
            пусто — создайте колоду или сделайте карточку из заметки во вкладке «Пространство»
          </li>
        )}
        {decks.map((deck) => {
          const counts = deckCounts(data, deck.id, now);
          const size = data.cards.filter((c) => c.deckId === deck.id).length;
          const due = counts.new + counts.learning + counts.review;
          return (
            <li key={deck.id} className="deck-row">
              {renaming === deck.id ? (
                <RenameDeck id={deck.id} name={deck.name} onDone={() => setRenaming(null)} />
              ) : (
                <button type="button" className="deck-open" onClick={() => onOpen(deck.id)}>
                  <span className="deck-name">{deck.name}</span>
                  <span className="muted deck-size">карточек: {size}</span>
                </button>
              )}
              <DeckCountsBadges counts={counts} />
              <button
                type="button"
                className="btn small"
                disabled={due === 0}
                aria-label={`Учить «${deck.name}»`}
                onClick={() => onStudy(deck.id)}
              >
                Учить
              </button>
              <IconButton
                icon="edit"
                label={`Переименовать «${deck.name}»`}
                onClick={() => setRenaming(deck.id)}
              />
              <IconButton
                icon="trash"
                label={`Удалить колоду «${deck.name}»`}
                danger
                onClick={() => {
                  const ok = window.confirm(
                    `Удалить колоду «${deck.name}» вместе с карточками (${size}) и историей их повторений?`,
                  );
                  if (ok) apply((d) => deleteDeck(d, deck.id));
                }}
              />
            </li>
          );
        })}
      </ul>

      <label className="new-per-day">
        <span className="muted">Новых карточек в день (в каждой колоде)</span>
        <input
          className="input"
          type="number"
          min={NEW_CARDS_LIMITS.min}
          max={NEW_CARDS_LIMITS.max}
          value={data.settings.newCardsPerDay}
          onChange={(e) => {
            const value = e.target.valueAsNumber;
            if (Number.isFinite(value)) apply((d) => setNewCardsPerDay(d, value));
          }}
        />
      </label>
    </section>
  );
}
