# Task Tracker

Personal productivity app: Eisenhower matrix, Kanban board, Pomodoro timer and a workspace for notes, with one shared set of tasks. The interface is in Russian.

**Open the web app:** https://theleriz.github.io/TaskBoot/ · **Download for Windows:** [latest release](https://github.com/Theleriz/TaskBoot/releases/latest)

Hybrid architecture: the web app is the primary codebase, and the Windows app is a thin WebView2 shell around it. See [docs/phase-0.md](docs/phase-0.md).

## Repository layout

| Path | Contents |
|---|---|
| `web/` | Web app, the primary codebase: Vite + React + TypeScript. Commands: [web/README.md](web/README.md). |
| `win32/` | Windows app: a WPF + WebView2 shell (.NET Framework 4.8) that hosts the web app. Build instructions: [win32/README.md](win32/README.md). |
| `docs/specs/` | Product specs (in Russian). |
| `docs/` | [Architecture](docs/architecture.md), [bridge protocol](docs/bridge-protocol.md), [versioning](docs/versioning.md), [roadmap](docs/roadmap.md), [phase 0](docs/phase-0.md) and [phase 1](docs/phase-1.md) plans, [secrets policy](docs/secrets-policy.md) (in Russian, except the secrets policy). |
| `tools/` | `third-party-notices.mjs` — generates [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). |

The tag `wpf-legacy` marks the last commit with the full standalone WPF interface; the tag `v2.0.0` is the last one with the previous single-file web version (`web/legacy/`).

## Quick start

- **Windows app:** run `win32\build.cmd` (needs Node.js and the .NET SDK), then `win32\dist\TaskTracker\TaskTracker.exe`.
- **Web app:** `cd web`, `npm ci`, `npm run dev`.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests: web type check, lint, format check, tests and build; Windows shell build and package (downloadable as a workflow artifact).
- **Release** (`release.yml`): push a tag such as `v2.1.0` (which digit to bump: [docs/versioning.md](docs/versioning.md); tags with a suffix like `-beta.1` become pre-releases). The workflow builds both versions and creates a GitHub Release with `TaskTracker-<version>-windows.zip` (unzip and run `TaskTracker.exe`) and `TaskTracker-<version>-web.zip`.
- **GitHub Pages** (`pages.yml`): publishes the web app to https://theleriz.github.io/TaskBoot/ on every change to `web/` in `main`. Controlled by the repository variable `DEPLOY_PAGES=true` (remove it to pause publishing).
- **Dependabot** opens weekly update PRs for npm, NuGet and GitHub Actions, plus security-fix PRs for vulnerable dependencies.
- **Branch protection**: `main` accepts changes only through pull requests with both CI checks green ([CONTRIBUTING.md](CONTRIBUTING.md)).

## Rules

- **`main` is always working**: every change goes through a branch and a pull request with green CI; new features are first released from their branch as a beta / pre-release; bug fixes come with a test. Direct pushes to `main` only for urgent security fixes (leaked secrets or user data) or by the main developer. Full rules (in Russian): [CONTRIBUTING.md](CONTRIBUTING.md).
- Never commit secrets, keys, `.env.local` or AI-agent context; see [docs/secrets-policy.md](docs/secrets-policy.md).
- External dependencies follow spec section 4.1 (permissive licenses, pinned versions, offline-first). After adding or updating one, regenerate the notices: `node tools/third-party-notices.mjs` (CI fails if the file is out of date).
