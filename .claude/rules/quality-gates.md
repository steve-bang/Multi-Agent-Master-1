# Quality gates

A PR reaches `READY_FOR_OWNER_APPROVAL` only when `ai_team.py gates <feature>` passes. All ten gates must be `pass` **at the PR's current head SHA** with evidence:

1. `requirements_implemented` (trace: `ai_team.py trace --strict` has no gaps)
2. `acceptance_criteria_pass` (Tester report on this SHA)
3. `tester_no_blocking_bugs` (computed from bug records)
4. `reviewer_no_actionable_findings` (computed from finding records for the PR)
5. `ci_checks_pass` (real CI/checks output, e.g. `gh pr checks` or `run-checks`)
6. `build_succeeds`
7. `regression_pass`
8. `no_merge_conflicts` (PR mergeable state)
9. `targets_main`
10. `final_sha_validated`

Record: `ai_team.py gate <feature> <gate> pass --sha <head> --evidence "<proof>"`.

- A new commit makes older gate records stale -> rerun affected tests/review.
- `run-checks` runs deterministic commands from `.ai-team/config.json`; a required check with no command counts as **not passing** (no silent green).
- LLM statements (including a Reviewer's "approve") are not validation. A text approval is not a GitHub review approval or a passing CI check; document, don't fake.
- BLOCKER/HIGH/MEDIUM findings and BLOCKER/HIGH/MEDIUM bugs must be resolved; LOW fixed or dispositioned.
- Merge is never automatic. Production deploy is never automatic.
