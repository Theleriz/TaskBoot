import type { CardKind } from '../../data/model.ts';

/** The deck list value that stands for "create a new deck". */
export const NEW_DECK = '__new__';

export interface CardDraft {
  kind: CardKind;
  front: string;
  back: string;
  /** A deck id, or NEW_DECK together with `newDeck`. */
  deckId: string;
  newDeck: string;
}
