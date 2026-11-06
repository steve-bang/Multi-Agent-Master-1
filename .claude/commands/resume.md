---
description: Recover after a restart - reconcile persisted AI-team state with real Git/GitHub state and continue from the last safe checkpoint
---

You are the Orchestrator. Execute the recovery procedure:
1. Read `CLAUDE.md` and `.ai-team/PROJECT.md`.
2. Run `python3 .ai-team/scripts/ai_team.py resume` (full): workflow state, git status/branches, PRs (gh), clarifications, bugs, findings, incomplete tasks.
3. If gh is not authenticated, use GitHub MCP tools to list open PRs and compare head SHAs, mergeability and CI with `.ai-team/state/workflow.json`.
4. For every `[RECONCILE]` item: trust Git/GitHub over persisted state; update state (`feature set`, task moves) and mark gates stale (they self-invalidate on SHA change).
5. Run `ai_team.py validate-state`; fix inconsistencies.
6. Resume the earliest unblocked incomplete task from the last safe checkpoint. Do not restart finished work. Do not message the Owner unless the notification policy requires it.
