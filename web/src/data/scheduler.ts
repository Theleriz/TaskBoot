// Spaced repetition with FSRS (ts-fsrs). The app stores plain numbers (Schedule); ts-fsrs works
// with Date objects, so every call converts both ways. Results depend only on the inputs:
// the fuzz that spreads intervals is seeded from the card, not from Math.random().

import { type Card, type Grade, createEmptyCard, fsrs } from 'ts-fsrs';
import type { CardRating, CardState, Schedule } from './model.ts';

const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 36500, enable_fuzz: true });

function toFsrs(s: Schedule): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview),
  };
}

function fromFsrs(c: Card): Schedule {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number as CardState,
    lastReview: c.last_review ? c.last_review.getTime() : null,
  };
}

/** A review item that has never been studied, due right away. */
export function newSchedule(now: number): Schedule {
  return fromFsrs(createEmptyCard(new Date(now)));
}

/** The schedule after answering with `rating` at `now`. */
export function review(s: Schedule, rating: CardRating, now: number): Schedule {
  return fromFsrs(scheduler.next(toFsrs(s), new Date(now), rating as number as Grade).card);
}

/** When the item would be due again for each answer: for the labels on the answer buttons. */
export function previewDue(s: Schedule, now: number): Record<CardRating, number> {
  const preview = scheduler.repeat(toFsrs(s), new Date(now));
  return {
    1: preview[1].card.due.getTime(),
    2: preview[2].card.due.getTime(),
    3: preview[3].card.due.getTime(),
    4: preview[4].card.due.getTime(),
  };
}
