# Task Tracker

Personal productivity app: Eisenhower matrix, Kanban board, Pomodoro timer and a workspace for notes, with one shared set of tasks. The interface is in Russian.

Hybrid architecture: the web app is the primary codebase, and the Windows app is a thin WebView2 shell around it. See [docs/phase-0.md](docs/phase-0.md).

## Repository layout

| Path | Contents |
|---|---|
| `web/` | Web app, the primary codebase: Vite + React + TypeScript. Commands: [web/README.md](web/README.md). |
| `web/legacy/` | Previous single-file web version (`index.html`), kept until the new web app reaches parity. |
| `win32/` | Windows app: a WPF + WebView2 shell (.NET Framework 4.8) that hosts the web app. Build instructions: [win32/README.md](win32/README.md). |
| `docs/specs/` | Product specs (in Russian). |
| `docs/` | [Roadmap](docs/roadmap.md), [phase 0 plan](docs/phase-0.md), [secrets policy](docs/secrets-policy.md). |

The tag `wpf-legacy` marks the last commit with the full standalone WPF interface.

## Quick start

- **Windows app:** run `win32\build.cmd` (needs Node.js and the .NET SDK), then `win32\dist\TaskTracker\TaskTracker.exe`.
- **Web app:** `cd web`, `npm ci`, `npm run dev`.
- **Previous web version:** open `web/legacy/index.html` in a browser.

## Rules

- Never commit secrets, keys, `.env.local` or AI-agent context; see [docs/secrets-policy.md](docs/secrets-policy.md).
- External dependencies follow spec section 4.1 (permissive licenses, pinned versions, offline-first).
