import { describe, expect, it } from 'vitest';
import { IDLE, formatTime, isFinished, pause, progress, remainingMs, start } from './timer.ts';

const FULL = 45 * 60_000;

describe('timer', () => {
  it('shows the full duration while idle', () => {
    expect(remainingMs(IDLE, FULL, 0)).toBe(FULL);
  });

  it('counts down, pauses and resumes', () => {
    const running = start(IDLE, FULL, 1_000);
    expect(remainingMs(running, FULL, 61_000)).toBe(FULL - 60_000);

    const paused = pause(running, 61_000);
    expect(paused.state).toBe('paused');
    expect(remainingMs(paused, FULL, 999_999)).toBe(FULL - 60_000);

    const resumed = start(paused, FULL, 100_000);
    expect(remainingMs(resumed, FULL, 100_000)).toBe(FULL - 60_000);
  });

  it('finishes at the end time', () => {
    const running = start(IDLE, 60_000, 0);
    expect(isFinished(running, 59_999)).toBe(false);
    expect(isFinished(running, 60_000)).toBe(true);
    expect(progress(running, 60_000, 30_000)).toBeCloseTo(0.5);
  });

  it('formats minutes above 59', () => {
    expect(formatTime(180 * 60_000)).toBe('180:00');
    expect(formatTime(61_500)).toBe('01:02');
    expect(formatTime(0)).toBe('00:00');
  });
});
