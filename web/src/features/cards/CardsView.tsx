import { useState } from 'react';
import { useAppData } from '../../state/hooks.ts';
import { DeckList } from './DeckList.tsx';
import { DeckPane } from './DeckPane.tsx';
import type { DeckScope } from './queue.ts';
import { StudyView } from './StudyView.tsx';

type Screen =
  | { kind: 'decks' }
  | { kind: 'deck'; deckId: string }
  | { kind: 'study'; scope: DeckScope; from: 'decks' | 'deck' };

/** Phase 1.5: the flashcards tab — decks, cards and study sessions (FSRS). */
export function CardsView({ onOpenNote }: { onOpenNote: (noteId: string) => void }) {
  const { data } = useAppData();
  const [screen, setScreen] = useState<Screen>({ kind: 'decks' });
  const deckName = (id: string) => data.decks.find((d) => d.id === id)?.name;

  // A deck deleted elsewhere (or by an import) takes the screen back to the list.
  const current: Screen =
    (screen.kind === 'deck' && !deckName(screen.deckId)) ||
    (screen.kind === 'study' && screen.scope !== null && !deckName(screen.scope))
      ? { kind: 'decks' }
      : screen;

  return (
    <div className="cards-view">
      {current.kind === 'decks' && (
        <DeckList
          onOpen={(deckId) => setScreen({ kind: 'deck', deckId })}
          onStudy={(scope) => setScreen({ kind: 'study', scope, from: 'decks' })}
        />
      )}
      {current.kind === 'deck' && (
        <DeckPane
          deckId={current.deckId}
          onBack={() => setScreen({ kind: 'decks' })}
          onStudy={() => setScreen({ kind: 'study', scope: current.deckId, from: 'deck' })}
          onOpenNote={onOpenNote}
        />
      )}
      {current.kind === 'study' && (
        <StudyView
          key={current.scope ?? 'all'}
          scope={current.scope}
          title={current.scope === null ? 'Все колоды' : (deckName(current.scope) ?? '')}
          onExit={() =>
            setScreen(
              current.from === 'deck' && current.scope !== null
                ? { kind: 'deck', deckId: current.scope }
                : { kind: 'decks' },
            )
          }
          onOpenNote={onOpenNote}
        />
      )}
    </div>
  );
}
