import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { TABS } from './tabs.ts';

describe('App shell', () => {
  it('shows every tab from the specs', () => {
    render(<App />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(TABS.map((t) => t.title));
  });

  it('starts on the matrix tab and switches on click', async () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Эйзенхауэр' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Канбан' }));

    expect(screen.getByRole('tab', { name: 'Канбан' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Канбан');
  });
});
