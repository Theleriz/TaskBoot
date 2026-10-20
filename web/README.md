# Task Tracker — web app

The primary codebase of Task Tracker: Vite + React + TypeScript. The same build runs in the browser (GitHub Pages) and inside the Windows WebView2 shell, so asset paths are relative (`base: './'`).

## Requirements

- Node.js 22.12 or newer (Node 24 is used in development).

## Commands

Run them from this folder (`web/`):

```bash
npm ci
```

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `npm run dev`     | Dev server with hot reload at http://localhost:5173                |
| `npm run build`   | Type-check and build to `dist/`                                    |
| `npm run preview` | Serve the built `dist/` locally                                    |
| `npm run test`    | Unit tests (Vitest + Testing Library, jsdom)                       |
| `npm run lint`    | ESLint                                                             |
| `npm run format`  | Format with Prettier                                               |
| `npm run check`   | Type-check, lint, format check and tests — run before every commit |

## Layout

| Path                      | Contents                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/main.tsx`            | Entry point: picks the environment (browser or WebView2 shell)                                      |
| `src/App.tsx`             | Providers and the app shell: tabs, timer widget, settings gear, details panel                       |
| `src/features/boards/`    | Eisenhower matrix and Kanban: zones, cards, drag and drop                                           |
| `src/features/details/`   | Task details panel: title, position, description, checklist, links                                  |
| `src/features/pomodoro/`  | Timers, ticker (Web Worker), sounds, header widget, window title                                    |
| `src/features/workspace/` | Notes and secrets                                                                                   |
| `src/features/settings/`  | Themes (modes, custom colors, random, saved) and data export / import                               |
| `src/state/`              | App data context with debounced saving; pure operations on the data (`ops.ts`)                      |
| `src/theme/`              | Palette generator (background + accent → CSS variables), ported from the native app                 |
| `src/platform/`           | Browser vs. shell features: notifications, title, taskbar, external links                           |
| `src/data/`               | Data model, normalization, schema migrations, storage (browser / shell / memory), import and export |
| `src/bridge/`             | Messaging with the Windows WebView2 shell; contract in `docs/bridge-protocol.md`                    |
| `src/styles/`             | Design tokens and app styles                                                                        |
| `public/`                 | Static files copied as is (icon)                                                                    |
| `legacy/`                 | Previous single-file version; excluded from lint, format and build                                  |

## Dependencies

Versions are pinned (`.npmrc` has `save-exact=true`; `package-lock.json` is committed). New dependencies must follow spec section 4.1 (permissive license, actively maintained, no telemetry). Only `react`, `react-dom` and `scheduler` (MIT) are shipped in the build; everything else is development tooling. The build includes `THIRD_PARTY_NOTICES.md` from the repository root; regenerate it with `node tools/third-party-notices.mjs` after dependency changes.
