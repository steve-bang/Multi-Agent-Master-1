# Git workflow

- Default branch is `main` (see `.ai-team/config.json`). **Never commit, edit, merge or push on `main`.** Hooks block this; do not work around them.
- Branch names: `ai/<feature-slug>` (e.g. `ai/user-login`). One feature = one branch = one PR targeting `main`. State files (`.ai-team/`) are committed on the feature branch and reach `main` through the PR.
- Start: `git fetch origin main && git switch -c ai/<slug> origin/main` (bootstrap of an empty repo: branch from the first commit).
- Commits: small, meaningful, imperative subject; reference REQ/task IDs (`T-003 REQ-002: validate email`). No secrets. Never `--no-verify`.
- Push only the feature branch: `git push -u origin ai/<slug>` (retry network failures up to 4 times with 2/4/8/16 s backoff). Never force-push.
- PR: `gh pr create --base main` or GitHub MCP `create_pull_request`. Use the repo PR template (`.github/pull_request_template.md`). If neither gh nor MCP can write, report the exact manual step - never invent a PR number.
- Concurrent development tasks use separate worktrees (`git worktree add ../wt-<task> -b ai/<slug>-<task>`); the Orchestrator integrates sequentially and resolves conflicts by delegating to the Developer.
- Tester and Reviewer always name the SHA they validated. A new commit invalidates gates recorded at an older SHA.
- Merging is done by the Project Owner. Never auto-merge, never auto-deploy.
- Fixes for findings/bugs are new commits on the same PR branch (no history rewriting).
