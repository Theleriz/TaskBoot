# Secrets and Data Protection Policy

This policy applies to everyone who contributes to this repository, human or AI agent. Its goal is simple: no secret, credential, personal data or agent context ever reaches the repository or its remote, in any branch, commit, tag, issue or pull request.

## 1. What must never be committed

- **Secrets and credentials:** API keys, access tokens, passwords, OAuth client secrets, session cookies, connection strings with passwords, webhook URLs that contain tokens.
- **Private keys and certificates:** `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.snk`, SSH keys, code-signing certificates and their passwords.
- **Real environment files:** `.env.local` and any `.env.*.local`.
- **Application data:** Task Tracker's `data.json` and its `*.corrupt-*` backups. The app stores notes and "secrets" in plain text, so these files are treated as sensitive.
- **AI agent context:** agent settings, transcripts, memory, plans, skills, launch configs and local instruction files, for example `.claude/`, `CLAUDE.local.md`, `.Agents/`, `.Skill/`, `.cursor/`, `.windsurf/`, `.continue/`, `.codex/`, `.aider*`.
- **Personal data:** real names, e-mail addresses, phone numbers or other personal information in fixtures, screenshots, logs or examples. Use made-up data.

All of the above is covered by `.gitignore`. When you add a new tool, add its local/config folder to `.gitignore` in the same commit that introduces the tool.

## 2. Environment variables

- Real values go **only** into `.env.local` at the project root. This file is ignored by git and must never be shared.
- `.env` is the committed **example**. It lists every variable the project understands, with a placeholder or safe default and a short comment. It must never contain a real secret.
- When you add a new variable:
  1. add it to `.env` with a placeholder value and a comment;
  2. put the real value into your own `.env.local`;
  3. document it in the README if it changes how the app is built or run.
- Load order, when a tool loads env files: `.env` first, then `.env.local` overrides it.
- Never hard-code secrets in source code, scripts, build files or tests. Read them from the environment.
- Never print secrets to logs, error messages, screenshots or CI output.

## 3. Rules for AI agents

AI coding agents working in this repository must:

- never commit, push or paste into issues/PRs the contents of their own context folders (`.claude/` and similar), transcripts, memory or plans;
- never write secrets into source files, docs, commit messages, PR descriptions or code comments, even temporarily;
- read secrets only from the environment (`.env.local` / process environment), and never echo their values back in chat output;
- run `git status` and review the staged diff before every commit, and stop if anything from section 1 is staged;
- never list themselves as an author or co-author of commits or pull requests.

## 4. Before every commit

- [ ] `git status` shows no ignored-category files staged (agent folders, `.env.local`, keys, `data.json`).
- [ ] `git diff --staged` contains no tokens, passwords, keys or personal data.
- [ ] New config/tool folders are covered by `.gitignore`.
- [ ] Example values in `.env`, docs and tests are placeholders.

## 5. If a secret leaks

Removing the file in a new commit is **not enough**: the secret stays in the git history and in every clone and fork.

1. **Revoke or rotate the secret immediately** at its provider. Treat it as compromised from the moment it was pushed.
2. Remove it from the working tree and add the path to `.gitignore`.
3. If the repository is public or shared, rewrite history to purge it (for example with `git filter-repo`), then force-push and ask collaborators to re-clone. Coordinate this with the repository owner.
4. Check GitHub secret-scanning alerts and the repository's forks.
5. Note what happened and what was rotated, without including the secret itself.

## 6. Recommended GitHub settings

- Enable **secret scanning** and **push protection** for the repository.
- Protect the `main` branch: require pull requests for changes.
- Keep the repository private until sensitive history has been reviewed.
