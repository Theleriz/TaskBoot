# Task Tracker

Personal productivity app: Eisenhower matrix, Kanban board, Pomodoro timer and a workspace for notes, with one shared set of tasks. The interface is in Russian.

The project is moving to a hybrid architecture: the web app is the primary codebase, and the Windows app becomes a thin WebView2 shell around it. See [docs/phase-0.md](docs/phase-0.md).

## Repository layout

| Path | Contents |
|---|---|
| `web/` | Web app, the primary codebase. The new build (Vite + React + TypeScript) arrives in phase 0.2. |
| `web/legacy/` | Previous single-file web version (`index.html`), kept until the new web app reaches parity. |
| `win32/` | Windows app. Currently the standalone WPF version; becomes the WebView2 shell in phase 0.5. Build instructions: [win32/README.md](win32/README.md). |
| `docs/specs/` | Product specs (in Russian). |
| `docs/` | [Roadmap](docs/roadmap.md), [phase 0 plan](docs/phase-0.md), [secrets policy](docs/secrets-policy.md). |

The tag `wpf-legacy` marks the last commit with the full standalone WPF interface.

## Quick start

- **Windows app (current WPF version):** run `win32\build.cmd`, then `win32\bin\TaskTracker.exe`.
- **Previous web version:** open `web/legacy/index.html` in a browser.

## Rules

- Never commit secrets, keys, `.env.local` or AI-agent context; see [docs/secrets-policy.md](docs/secrets-policy.md).
- External dependencies follow spec section 4.1 (permissive licenses, pinned versions, offline-first).
