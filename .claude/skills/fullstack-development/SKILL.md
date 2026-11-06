---
name: fullstack-development
description: Procedure for the Senior Fullstack Developer to plan, implement, test, push and open a PR for approved requirements, and to fix Tester bugs and Reviewer findings on the same branch with evidence.
---

# Fullstack development procedure (Developer)

## A. Technical plan (Phase 4)
1. Inspect architecture, conventions, existing test/build commands. 2. Write `.ai-team/architecture/technical-designs/<slug>.md`: approach, data model/migrations (reversible, non-destructive), API contract in `api-contracts/`, security considerations, test strategy, task ordering. 3. Significant decisions -> `.ai-team/decisions/ADR/NNNN-title.md`. 4. Propose real build/lint/test commands for `.ai-team/config.json`. 5. Business gaps -> OPEN_QUESTION to `ba`.

## B. Implement (Phase 5)
1. Confirm branch is `ai/<slug>` and not `main` (`git branch --show-current`). 2. Implement only approved REQs/specs. 3. Write unit + integration tests with REQ IDs in names/comments. 4. Run `python3 .ai-team/scripts/ai_team.py run-checks` (and project commands); fix until green; capture exact output. 5. Commit meaningfully (`T-003 REQ-002: ...`), no secrets. 6. `git push -u origin ai/<slug>` (retry 4x, backoff 2/4/8/16s). 7. Open PR against `main` with the repo template (gh or GitHub MCP); if impossible, report the exact manual step. 8. Report HANDOFF with HEAD_SHA and evidence.

## C. Fix bugs/findings (revision)
1. Read each record (`.ai-team/testing/bug-reports/`, `.ai-team/reviews/findings/`): reproduce first. 2. Fix on the same branch; add a regression test. 3. Re-run checks. 4. Commit referencing the ID; push. 5. Report for each ID: fixing SHA + evidence. **Do not close records** - Reviewer/Tester verify. 6. If you disagree with a finding, return a reasoned objection; don't ignore it.

## Never
Push/commit on `main`; merge own PR; invent business rules; disable tests; destructive migrations without Owner approval.
