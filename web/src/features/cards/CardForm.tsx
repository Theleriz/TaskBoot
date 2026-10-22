import { useRef, useState } from 'react';
import { nextClozeNumber } from '../../data/cloze.ts';
import type { CardKind, Deck } from '../../data/model.ts';
import { cardProblem } from '../../state/ops.ts';
import { type CardDraft, NEW_DECK } from './drafts.ts';

const KINDS: { kind: CardKind; title: string }[] = [
  { kind: 'basic', title: 'Вопрос — ответ' },
  { kind: 'cloze', title: 'Пропуски' },
];

/**
 * Create or edit a flashcard. `decks` shows a deck list (with "new deck"); without it the deck is
 * fixed. `presets` gives starting texts per kind (a card made from a note): switching the kind
 * swaps them while the text has not been edited.
 */
export function CardForm({
  initial,
  decks,
  presets,
  submitLabel,
  onSubmit,
  onCancel,
  extra,
}: {
  initial: CardDraft;
  decks?: Deck[];
  presets?: Record<CardKind, { front: string; back: string }>;
  submitLabel: string;
  onSubmit: (draft: CardDraft) => void;
  onCancel?: () => void;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const front = useRef<HTMLTextAreaElement>(null);
  const cloze = draft.kind === 'cloze';
  const set = (patch: Partial<CardDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const pickKind = (kind: CardKind) => {
    const preset = presets?.[kind];
    const untouched =
      presets &&
      draft.front === presets[draft.kind].front &&
      draft.back === presets[draft.kind].back;
    set(preset && untouched ? { kind, ...preset } : { kind });
  };

  /** Wraps the selected text into the next gap: "{{c2::selection}}". */
  const addGap = () => {
    const el = front.current;
    if (!el) return;
    const { selectionStart: from, selectionEnd: to, value } = el;
    const n = nextClozeNumber(value);
    const inner = value.slice(from, to) || 'ответ';
    const next = `${value.slice(0, from)}{{c${n}::${inner}}}${value.slice(to)}`;
    set({ front: next });
    // setTimeout, not requestAnimationFrame: frames pause while the page is hidden.
    setTimeout(() => {
      el.focus();
      const start = from + `{{c${n}::`.length;
      el.setSelectionRange(start, start + inner.length);
    });
  };

  const submit = () => {
    const problem =
      cardProblem(draft) ??
      (draft.deckId === NEW_DECK && !draft.newDeck.trim() ? 'Введите название колоды' : null);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(draft);
  };

  return (
    <form
      className="card-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="row">
        <div className="chips" role="radiogroup" aria-label="Тип карточки">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              className="chip"
              aria-checked={draft.kind === k.kind}
              onClick={() => pickKind(k.kind)}
            >
              {k.title}
            </button>
          ))}
        </div>
        {decks && (
          <label className="card-deck">
            <span className="muted">Колода</span>
            <select
              className="select"
              value={draft.deckId}
              onChange={(e) => set({ deckId: e.target.value })}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value={NEW_DECK}>+ Новая колода…</option>
            </select>
          </label>
        )}
        {decks && draft.deckId === NEW_DECK && (
          <input
            className="input card-new-deck"
            aria-label="Название новой колоды"
            placeholder="Название колоды"
            maxLength={200}
            value={draft.newDeck}
            onChange={(e) => set({ newDeck: e.target.value })}
          />
        )}
      </div>

      <div className="card-field">
        <span className="card-field-head">
          <span>{cloze ? 'Текст с пропусками' : 'Вопрос'}</span>
          {cloze && (
            <button type="button" className="btn small" onClick={addGap}>
              Сделать пропуском
            </button>
          )}
        </span>
        <textarea
          ref={front}
          className="textarea"
          rows={cloze ? 4 : 3}
          aria-label={cloze ? 'Текст с пропусками' : 'Вопрос'}
          placeholder={cloze ? 'Столица Франции — {{c1::Париж}}' : 'Markdown и формулы: $E = mc^2$'}
          value={draft.front}
          onChange={(e) => set({ front: e.target.value })}
        />
      </div>
      <div className="card-field">
        <span className="card-field-head">
          {cloze ? 'Дополнение к ответу (необязательно)' : 'Ответ'}
        </span>
        <textarea
          className="textarea"
          rows={3}
          aria-label={cloze ? 'Дополнение к ответу' : 'Ответ'}
          value={draft.back}
          onChange={(e) => set({ back: e.target.value })}
        />
      </div>

      {error && <div className="field-error">{error}</div>}
      <p className="hint">
        {cloze
          ? 'Выделите слово и нажмите «Сделать пропуском». Пропуски с одним номером скрываются вместе; каждый номер — отдельная карточка.'
          : 'Markdown и формулы KaTeX работают в вопросе и в ответе.'}{' '}
        Ctrl+Enter — сохранить.
      </p>
      <div className="row">
        <button type="submit" className="btn primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
        )}
        {extra}
      </div>
    </form>
  );
}
