---
name: project-orchestration
description: Run the full 9-phase AI-team lifecycle for a new idea or feature - intake, BA, design, technical planning, development, testing, PR review, quality gate, final delivery. Use whenever the Project Owner provides a product idea, feature request or asks to continue a feature.
---

# Project orchestration procedure (Orchestrator only)

Notification rule: work silently; message the Owner only per CLAUDE.md "Notification policy".

## Phase 1 - Intake
1. Run `python3 .ai-team/scripts/ai_team.py resume --brief`; skip intake if the feature already exists.
2. Inspect the repo (stack, structure, tests, CI, docs). Read `.ai-team/PROJECT.md` and `.ai-team/config.json`.
3. Pick slug; `git switch -c ai/<slug>` (from `origin/main` if it exists); `ai_team.py feature new <slug> --branch ai/<slug> --title "..."`.
4. Draft plan in `.ai-team/backlog/epics/<slug>.md`: scope, complexity, known gaps, task list. Create tasks T-001... with `task new` (requirements/design/tech/dev/test/review).
5. Do not start complex coding before requirements are clear.

## Phase 2 - Business analysis
Parallelize: BA task + codebase research (Explore-style, read-only) in one message.
1. Delegate to `ba` with the task contract. 2. Take BA's `OPEN_QUESTIONS`; for each, `clarify new ... --route client --blocks T-xxx`.
3. Delegate to `client`; record CONFIRMED answers (with source). Batch every INFERRED/UNKNOWN into ONE Owner message (issue, why needed, context, recommendation, options, blocked tasks) and stop affected tasks only. 4. After answers, BA updates requirements. Gate: all in-scope REQs CONFIRMED.

## Phase 3 - UX/UI
If the feature has a UI: delegate `designer` with approved REQs. Designer questions -> BA. Skip with a recorded note if no UI.

## Phase 4 - Technical planning
Delegate `senior-fullstack-dev` (planning only): technical design, DB changes, API contracts, ADRs, test strategy, task dependencies, and fill in `.ai-team/config.json` check commands if null. Major architecture/scope decisions -> Owner approval. No unresolved critical business decision may remain.

## Phase 5 - Development
Delegate implementation tasks in dependency order (API contract before dependent frontend). Concurrent dev tasks -> separate worktrees; never two agents on the same files. On `SUBMITTED`: verify the claim yourself (`git log`, `run-checks`, PR exists via gh/MCP) before moving on. `feature set <slug> --pr <n> --head-sha <sha>`.

## Phase 6 and 7 - Test and review (parallel on one SHA)
Spawn `tester` and `reviewer` in the same message with the same SHA. Create bug/finding records (`record new`). Revision loop: Dev fixes on same branch -> `FIXED_PENDING_VERIFICATION --sha` -> Reviewer re-reviews the new diff and Tester retests affected areas -> only they close records. Update head SHA each push. Respect loop limits in config; on non-convergence, produce a report and escalate.

## Phase 8 - Final quality gate
Run `trace --strict`, `run-checks`, check CI (`gh pr checks` / MCP), mergeability, base=main. Record each gate with SHA + evidence, then `ai_team.py gates <slug>`. Anything not passing -> back to Phase 5/6/7.

## Phase 9 - Final delivery
Write `.ai-team/reports/final/<slug>.md` from `.ai-team/templates/final-report.md` (requested, implemented, REQs, technical changes, tests, review results, PR link, limitations, risks, status). Set status READY_FOR_OWNER_APPROVAL, commit state, push branch, send ONE message to the Owner. Never merge unless `.ai-team/PROJECT.md` explicitly authorizes it.

## Always
Record handoffs; update state through `ai_team.py`; commit `.ai-team/` at checkpoints; `validate-state` before reporting; no claim without evidence.
