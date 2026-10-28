import { useEffect, useRef } from 'react';
import type { CardKind } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData, useToast } from '../../state/hooks.ts';
import { addCard, addDeck } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { CardForm } from './CardForm.tsx';
import { type CardDraft, NEW_DECK } from './drafts.ts';

/** A dialog to make a flashcard from a note (phase 1.5). The card keeps a link to the note. */
export function CardDialog({
  noteId,
  draft,
  presets,
  onClose,
}: {
  noteId: string;
  draft: CardDraft;
  presets: Record<CardKind, { front: string; back: string }>;
  onClose: () => void;
}) {
  const { data, apply } = useAppData();
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('textarea')?.focus();
  }, []);

  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Новая карточка" ref={box}>
        <div className="modal-head">
          <h2>Карточка из заметки</h2>
          <IconButton icon="x" label="Закрыть (Esc)" onClick={onClose} />
        </div>
        <CardForm
          initial={draft}
          decks={[...data.decks].sort((a, b) => a.name.localeCompare(b.name, 'ru'))}
          presets={presets}
          submitLabel="Создать карточку"
          onCancel={onClose}
          onSubmit={(d) => {
            const now = Date.now();
            const cardId = newId();
            const deckId = d.deckId === NEW_DECK ? newId() : d.deckId;
            const deckName =
              d.deckId === NEW_DECK
                ? d.newDeck.trim()
                : data.decks.find((x) => x.id === deckId)?.name;
            apply((state) => {
              if (d.deckId === NEW_DECK) addDeck(state, d.newDeck, deckId, now);
              addCard(state, { ...d, deckId, noteId }, cardId, now);
            });
            toast(`Карточка добавлена в колоду «${deckName ?? ''}»`);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
