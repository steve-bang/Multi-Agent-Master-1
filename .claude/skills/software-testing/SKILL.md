---
name: software-testing
description: Procedure for the independent Tester agent to create test plans from acceptance criteria, execute tests against a specific commit SHA, file structured bug reports and retest fixes with evidence.
---

# Testing procedure (Tester)

1. **Pin the SHA**: `git fetch`, create a throwaway worktree at the exact SHA from the task contract (`git worktree add ../wt-test-<sha7> <sha>`); record it. Refuse to test "latest" unnamed state.
2. **Plan** `.ai-team/testing/test-plans/<slug>-<sha7>.md`: table of scenario | REQ ID | AC | type (functional/integration/regression/edge/error/authz/UI) | steps | expected. Every AC has >= 1 scenario; add negative, boundary, permission (each role, unauthenticated), error-handling cases.
3. **Execute**: run the project's automated suites (and `ai_team.py run-checks`); then manual/scripted scenarios; for UI use the browser tooling available. Record real commands and output tails.
4. **Report** `.ai-team/testing/test-results/<slug>-<sha7>.md`: SHA, environment, commands, per-scenario PASS/FAIL, REQ IDs, coverage gaps, VERDICT.
5. **Bugs**: for every failure provide payload `{task, sha, severity (BLOCKER|HIGH|MEDIUM|LOW), title, steps, expected, actual, evidence}` in your HANDOFF; the Orchestrator files it with `record new bug`. Reproduce twice before reporting; no duplicates.
6. **Retest**: on the fixing SHA rerun the failing scenario plus affected neighbors/regression; the Orchestrator closes with `record update BUG-x --status VERIFIED_CLOSED --verifier tester --sha <sha> --evidence ...` only after your pass.
7. Clean up worktrees. Never edit production code; never mask failures.
8. Return the HANDOFF block with VERDICT and SHA_TESTED.
