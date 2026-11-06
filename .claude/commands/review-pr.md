---
description: Run an independent review (and parallel test run) on a PR's current head commit
argument-hint: <PR number>
---

PR: $ARGUMENTS

Orchestrator procedure:
1. Get the PR's current head SHA, base (must be `main`) and mergeability via `gh pr view` or GitHub MCP. Record with `ai_team.py feature set <slug> --pr <n> --head-sha <sha>`.
2. In ONE message, delegate to `reviewer` (skill `pull-request-review`) and `tester` (skill `software-testing`) with the same SHA.
3. File findings/bugs with `record new`; for fixes delegate to `senior-fullstack-dev`, then re-review/retest on the new SHA. Respect loop limits.
4. When clean, record gates and run `ai_team.py gates <slug>`. Report to the Owner only on READY_FOR_OWNER_APPROVAL or an escalation.
