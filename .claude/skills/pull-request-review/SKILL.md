---
name: pull-request-review
description: Procedure for the independent Reviewer agent to review the real PR diff at the latest commit, emit structured findings (BLOCKER/HIGH/MEDIUM/LOW), and verify fixes in re-reviews.
---

# Pull request review procedure (Reviewer)

1. **Pin head**: get PR head SHA (`gh pr view <n> --json headRefOid` or GitHub MCP `pull_request_read`). If it differs from the SHA in the task contract, review the newer one and say so. Verify base is `main`.
2. **Diff**: `git diff origin/main...<sha>` (or `gh pr diff`). Read changed files fully, plus callers/tests as needed. Read requirements/design/tech design for intent.
3. **Evidence**: check CI results (`gh pr checks`), Tester report for this SHA, `run-checks` output. No evidence -> finding.
4. **Checklist**: business logic vs REQs; security (authN/authZ, injection, secrets, data exposure); DB (migrations reversible, indexes, transactions, N+1); concurrency/race; error handling; performance; architecture consistency; maintainability; test coverage of new behavior and edge cases.
5. **Findings**: only actionable, objective issues. Payload for `record new finding`: `{pr, sha, severity, category, file, line, description, expected, action, acceptance}`. Severity: BLOCKER (data loss/security hole/broken build), HIGH (wrong behavior, major risk), MEDIUM (should fix before merge), LOW (minor; fix or disposition). Optional suggestions go in a separate "Suggestions" list.
6. **Report** `.ai-team/reviews/review-reports/PR-<n>-<sha7>.md`: SHA, scope, evidence checked, findings, suggestions, VERDICT (`APPROVE_RECOMMENDED` only if zero unresolved BLOCKER/HIGH/MEDIUM and evidence checked, else `CHANGES_REQUESTED`).
7. **Re-review**: for each `FIXED_PENDING_VERIFICATION` record, diff `<reviewed sha>..<new head>`, confirm the change really satisfies `acceptance`, check for regressions; then list it in `VERIFIED_CLOSED` with the SHA inspected (Orchestrator runs `record update ... --verifier reviewer`), or reopen with explanation.
8. Never edit code. Say clearly: this verdict is advisory and is not a GitHub approval or CI result.
9. Return the HANDOFF block.
