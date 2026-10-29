import { Suspense, lazy, useEffect, useState } from 'react';
import { DEFAULT_WORKSPACE, type Workspace } from './data/model.ts';
import { newId } from './data/ids.ts';
import { BacklogView } from './features/backlog/BacklogView.tsx';
import { Board } from './features/boards/Board.tsx';
import { DetailsPanel } from './features/details/DetailsPanel.tsx';
import { WorkspaceDialog } from './features/layout/WorkspaceDialog.tsx';
import { WorkspaceSwitcher } from './features/layout/WorkspaceSwitcher.tsx';
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
import { addWorkspace, deleteWorkspace, updateWorkspace } from './state/ops.ts';
import { TAB_TITLES, type TabId, VIEW_IDS, type ViewId } from './tabs.ts';
import { ThemeApplier } from './theme/ThemeApplier.tsx';
import { Icon } from './ui/Icon.tsx';
import { StatusBanner } from './ui/StatusBanner.tsx';
import { ToastProvider } from './ui/Toast.tsx';

const TAB_KEY = 'taskTracker.tab';
// The active workspace is a choice of this device, like the last tab; the workspaces are data.
const WORKSPACE_KEY = 'taskTracker.workspace';

function remember(prefs: Storage | null, key: string, value: string) {
  try {
    prefs?.setItem(key, value);
  } catch {
    /* only a convenience */
  }
}

// Flashcards load with their tab: the boards do not need them.
const CardsView = lazy(() =>
  import('./features/cards/CardsView.tsx').then((m) => ({ default: m.CardsView })),
);
const StatsView = lazy(() =>
  import('./features/stats/StatsView.tsx').then((m) => ({ default: m.StatsView })),
);

type Editing = { kind: 'edit'; workspace: Workspace } | { kind: 'new' } | null;

function Shell({ prefs }: { prefs: Storage | null }) {
  const { data, load, apply } = useAppData();
  const [view, setView] = useState<ViewId>(() => {
    const saved = prefs?.getItem(TAB_KEY);
    return VIEW_IDS.includes(saved as ViewId) ? (saved as ViewId) : 'matrix';
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    () => prefs?.getItem(WORKSPACE_KEY) ?? null,
  );
  const [editing, setEditing] = useState<Editing>(null);
  const workspaces = data.settings.workspaces;
  // A deleted or unknown workspace falls back to the first one.
  const workspace =
    workspaces.find((w) => w.id === workspaceId) ?? workspaces[0] ?? DEFAULT_WORKSPACE;
  // A view outside the workspace (a note opened from a card, a stale saved tab) shows as an
  // extra tab while it is open, so the user always sees where they are.
  const shownTabs: TabId[] =
    view === 'settings' || workspace.tabs.includes(view)
      ? workspace.tabs
      : [...workspace.tabs, view];
  const [detailsId, setDetailsId] = useState<string | null>(null);
  // A note to open in the workspace, chosen in task details (phase 1.4).
  const [noteToOpen, setNoteToOpen] = useState<string | null>(null);
  const detailsTask = detailsId ? data.tasks.find((t) => t.id === detailsId) : undefined;

  const select = (next: ViewId) => {
    setView(next);
    setDetailsId(null);
    setNoteToOpen(null);
    remember(prefs, TAB_KEY, next);
  };

  /** Switching keeps the current tab when the new workspace has it, else opens its first tab. */
  const switchWorkspace = (id: string) => {
    const next = workspaces.find((w) => w.id === id);
    if (!next) return;
    setWorkspaceId(id);
    remember(prefs, WORKSPACE_KEY, id);
    if (view !== 'settings' && !next.tabs.includes(view)) select(next.tabs[0] ?? 'matrix');
  };

  const openNote = (noteId: string) => {
    select('space');
    setNoteToOpen(noteId);
  };

  const closeDetails = () => {
    const id = detailsId;
    setDetailsId(null);
    // Back to the card the details were opened from.
    setTimeout(() => {
      if (id) document.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`)?.focus();
    });
  };

  // On a narrow screen the tab row scrolls: keep the open tab in sight.
  useEffect(() => {
    document
      .querySelector('[role=tablist] [aria-selected=true]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [view, workspace.id, load.kind]);

  if (load.kind === 'loading') return null;

  return (
    <>
      <header className="topbar">
        <div className="top-left">
          <WorkspaceSwitcher
            workspaces={workspaces}
            active={workspace}
            onSelect={switchWorkspace}
            onEdit={() => setEditing({ kind: 'edit', workspace })}
            onCreate={() => setEditing({ kind: 'new' })}
          />
          <nav className="tabs" role="tablist" aria-label="Разделы">
            {shownTabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`tab${workspace.tabs.includes(id) ? '' : ' outside'}`}
                aria-selected={view === id}
                title={
                  workspace.tabs.includes(id)
                    ? undefined
                    : 'Этой вкладки нет в рабочем пространстве'
                }
                onClick={() => select(id)}
              >
                {TAB_TITLES[id]}
              </button>
            ))}
          </nav>
        </div>
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
        {view === 'backlog' && (
          <section className="view scroll" role="tabpanel" aria-label="Бэклог">
            <BacklogView onOpen={setDetailsId} />
          </section>
        )}
        {view === 'pomodoro' && (
          <section className="view scroll" role="tabpanel" aria-label="Pomodoro">
            <PomodoroView />
          </section>
        )}
        {view === 'space' && (
          <section className="view scroll" role="tabpanel" aria-label="Пространство">
            {/* A new key opens the chosen note even when the workspace is already shown. */}
            <WorkspaceView
              key={noteToOpen ?? ''}
              prefs={prefs}
              openNoteId={noteToOpen}
              onOpenTask={setDetailsId}
            />
          </section>
        )}
        {view === 'cards' && (
          <section className="view scroll" role="tabpanel" aria-label="Карточки">
            <Suspense fallback={null}>
              <CardsView onOpenNote={openNote} />
            </Suspense>
          </section>
        )}
        {view === 'stats' && (
          <section className="view scroll" role="tabpanel" aria-label="Статистика">
            <Suspense fallback={null}>
              <StatsView />
            </Suspense>
          </section>
        )}
        {view === 'settings' && (
          <section className="view scroll" role="tabpanel" aria-label="Настройки">
            <SettingsView />
          </section>
        )}
      </main>

      {editing && (
        <WorkspaceDialog
          title={
            editing.kind === 'new'
              ? 'Новое рабочее пространство'
              : `Рабочее пространство «${editing.workspace.name}»`
          }
          initial={
            editing.kind === 'new'
              ? { name: 'Новое пространство', tabs: [...DEFAULT_WORKSPACE.tabs] }
              : editing.workspace
          }
          onClose={() => setEditing(null)}
          onSave={(input) => {
            if (editing.kind === 'new') {
              const id = newId();
              apply((d) => addWorkspace(d, input, id));
              setEditing(null);
              // The new workspace opens right away.
              setWorkspaceId(id);
              remember(prefs, WORKSPACE_KEY, id);
              if (view !== 'settings' && !input.tabs.includes(view)) select(input.tabs[0]!);
            } else {
              const id = editing.workspace.id;
              apply((d) => updateWorkspace(d, id, input));
              setEditing(null);
              if (view !== 'settings' && !input.tabs.includes(view)) select(input.tabs[0]!);
            }
          }}
          onDelete={
            editing.kind === 'edit' && workspaces.length > 1
              ? () => {
                  const target = editing.workspace;
                  if (
                    !window.confirm(
                      `Удалить рабочее пространство «${target.name}»? Задачи, заметки и карточки останутся.`,
                    )
                  ) {
                    return;
                  }
                  apply((d) => deleteWorkspace(d, target.id));
                  setEditing(null);
                  const rest = workspaces.filter((w) => w.id !== target.id);
                  if (target.id === workspace.id && rest[0]) switchWorkspace(rest[0].id);
                }
              : undefined
          }
        />
      )}

      {detailsTask && (
        <DetailsPanel
          key={detailsTask.id}
          task={detailsTask}
          onClose={closeDetails}
          onOpenNote={openNote}
        />
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
