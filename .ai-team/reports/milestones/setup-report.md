# AI team setup report (2026-11-06)

Status: **configured and validated; waiting for first product idea.** Repo was empty (no commits, empty remote, no app stack), so nothing was preserved or modified beyond new infrastructure.

## Architecture
Main Claude Code session = Orchestrator (`"agent": "orchestrator"` in `.claude/settings.json`; confirmed by a headless session answering as the Orchestrator). Six subagents (BA, Designer, Senior Fullstack Dev, Tester, Reviewer, Client) with least-privilege `tools:`. All communication is Orchestrator-mediated (subagents cannot message each other); handoffs are logged to `.ai-team/state/handoffs.jsonl`. Deterministic enforcement lives in `.ai-team/scripts/ai_team.py` (state machine, evidence rules, clarification loop, finding/bug lifecycle, gates, resume) and in PreToolUse hooks.

## Files
Created: `CLAUDE.md`, `.gitignore`, `.claude/{settings.json, agents/(7), skills/(7)/SKILL.md, rules/(5), commands/(5), hooks/(3)}`, `.ai-team/{README.md, PROJECT.md, config.json, state/, templates/, scripts/(ai_team, validate_config, simulate, 2 test files), full folder tree}`, `.github/{pull_request_template.md, workflows/ai-team-validate.yml}`. Modified: none (greenfield).

## Validation evidence (executed)
| Check | Result |
|---|---|
| `python3 .ai-team/scripts/validate_config.py` | 50/50 pass (agents, frontmatter, 8 required sections each, skills, commands, rules, settings, deny rules, hooks exist/compile, state schema, secrets scan) |
| `python3 -m unittest discover -s .ai-team/scripts -p "test_*.py"` | 17/17 pass (state machine, evidence, clarification gating, finding closure rules, gates + stale SHA, resume reconcile, trace, hook allow/block cases) |
| Claude CLI discovery (`claude -p --output-format stream-json` init event) | 7 agents, 7 skills, 5 commands discovered |
| Rules/persona load | headless session answered as Orchestrator, quoted branch prefix and all 10 gates from rule files |
| Simulation `simulate.py` | passes; report in `reports/simulation/simulation-report.md` (EXECUTED vs SIMULATED labelled; no PR, no remote) |
A real bug was found and fixed during validation: main-branch protection did not apply on an unborn branch.

## Status by area
Agents: done. Skills: done. Rules/commands: done. Hooks: SessionStart resume summary, Bash guard, Edit guard (active, tested). Permissions: deny list for force-push, main push, merge, secrets. Git workflow: documented + hook-enforced. Recovery: `resume` reconciles git vs persisted state (SHA drift marks gates stale).

## Limitations / manual configuration
1. **GitHub**: `gh` is not authenticated here (token invalid); GitHub MCP tools are the integration path in this environment. PR creation, CI status and real review approval were NOT exercised. A Reviewer's text verdict is advisory, not a GitHub approval.
2. **Remote has no `main` yet.** Setup lives on branch `ai/ai-team-setup`. Create `main` from it (or merge it) once; then enable branch protection on `main` (require PR, CI, 1 approval, no force-push) in GitHub settings - hooks cannot enforce server-side rules.
3. **`.ai-team/config.json` check commands are null** (no stack). Required checks with no command count as failing, so the `ai-team-validate` workflow's last step is red until the first technical plan fills them in.
4. Hook role fences (`agent_type`) are best-effort; primary role enforcement is each agent's `tools:` list. Subagent `isolation: worktree` for the Developer relies on current Claude Code support.
5. Trust prompt: accept the workspace trust dialog once, otherwise `permissions.allow` entries are ignored (observed).
6. Notifications are in-session only; no external integration is configured.
7. Merge and deploy are not authorized (`PROJECT.md`); default end state is READY_FOR_OWNER_APPROVAL.
