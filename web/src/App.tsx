import { useState } from 'react';
import { TABS, type TabId } from './tabs.ts';
import './App.css';

export function App() {
  const [tab, setTab] = useState<TabId>('matrix');
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="app">
      <header className="topbar">
        <nav className="tabs" role="tablist" aria-label="Разделы">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
            >
              {t.title}
            </button>
          ))}
        </nav>
      </header>
      <main className="placeholder" role="tabpanel" aria-label={current.title}>
        <h1>{current.title}</h1>
        <p>
          Новая веб-версия собирается в фазе 0. Функции этого раздела переносятся из прежней версии
          на шаге 0.4.
        </p>
      </main>
    </div>
  );
}
