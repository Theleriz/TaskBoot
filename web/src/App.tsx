import { useState } from 'react';
import { Board } from './features/boards/Board.tsx';
import { DetailsPanel } from './features/details/DetailsPanel.tsx';
import { PomodoroProvider } from './features/pomodoro/PomodoroProvider.tsx';
import { PomodoroView } from './features/pomodoro/PomodoroView.tsx';
import { TimerWidget } from './features/pomodoro/TimerWidget.tsx';
import { TitleSync } from './features/pomodoro/TitleSync.tsx';
import { SettingsView } from './features/settings/SettingsView.tsx';
import { AddTaskBar } from './features/tasks/AddTaskBar.tsx';
import { WorkspaceView } from './features/workspace/WorkspaceView.tsx';
import type { Environment } from './platform/platform.ts';
import { AppDataProvider } from './state/AppDataContext.tsx';
import { PlatformContext } from './state/contexts.ts';
import { useAppData } from './state/hooks.ts';
import { TABS, VIEW_IDS, type ViewId } from './tabs.ts';
import { ThemeApplier } from './theme/ThemeApplier.tsx';
import { Icon } from './ui/Icon.tsx';
import { StatusBanner } from './ui/StatusBanner.tsx';
import { ToastProvider } from './ui/Toast.tsx';

const TAB_KEY = 'taskTracker.tab';

function Shell({ prefs }: { prefs: Storage | null }) {
  const { data, load } = useAppData();
  const [view, setView] = useState<ViewId>(() => {
    const saved = prefs?.getItem(TAB_KEY);
    return VIEW_IDS.includes(saved as ViewId) ? (saved as ViewId) : 'matrix';
  });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsTask = detailsId ? data.tasks.find((t) => t.id === detailsId) : undefined;

  const select = (next: ViewId) => {
    setView(next);
    setDetailsId(null);
    try {
      prefs?.setItem(TAB_KEY, next);
    } catch {
      /* only a convenience */
    }
  };

  const closeDetails = () => {
    const id = detailsId;
    setDetailsId(null);
    // Back to the card the details were opened from.
    setTimeout(() => {
      if (id) document.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`)?.focus();
    });
  };

  if (load.kind === 'loading') return null;

  return (
    <>
      <header className="topbar">
        <nav className="tabs" role="tablist" aria-label="Разделы">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === t.id}
              onClick={() => select(t.id)}
            >
              {t.title}
            </button>
          ))}
        </nav>
        <div className="top-right">
          {/* F-41: the widget is hidden only on the Pomodoro tab (F-97: shown on the workspace). */}
          <TimerWidget hidden={view === 'pomodoro'} onOpen={() => select('pomodoro')} />
          <button
            type="button"
            role="tab"
            className="tab gear"
            aria-selected={view === 'settings'}
            aria-label="Настройки"
            title="Настройки"
            onClick={() => select('settings')}
          >
            <Icon name="gear" />
          </button>
        </div>
      </header>

      <StatusBanner />

      <main>
        {(view === 'matrix' || view === 'kanban') && <AddTaskBar />}
        {view === 'matrix' && (
          <section className="view" role="tabpanel" aria-label="Эйзенхауэр">
            <Board kind="matrix" onOpen={setDetailsId} />
          </section>
        )}
        {view === 'kanban' && (
          <section className="view" role="tabpanel" aria-label="Канбан">
            <Board kind="kanban" onOpen={setDetailsId} />
          </section>
        )}
        {view === 'pomodoro' && (
          <section className="view scroll" role="tabpanel" aria-label="Pomodoro">
            <PomodoroView />
          </section>
        )}
        {view === 'space' && (
          <section className="view scroll" role="tabpanel" aria-label="Пространство">
            <WorkspaceView />
          </section>
        )}
        {view === 'settings' && (
          <section className="view scroll" role="tabpanel" aria-label="Настройки">
            <SettingsView />
          </section>
        )}
      </main>

      {detailsTask && (
        <DetailsPanel key={detailsTask.id} task={detailsTask} onClose={closeDetails} />
      )}
    </>
  );
}

export function App({ env }: { env: Environment }) {
  return (
    <PlatformContext.Provider value={env.platform}>
      <ToastProvider>
        <AppDataProvider store={env.store}>
          <ThemeApplier />
          <PomodoroProvider>
            <TitleSync />
            <Shell prefs={env.prefs} />
          </PomodoroProvider>
        </AppDataProvider>
      </ToastProvider>
    </PlatformContext.Provider>
  );
}
