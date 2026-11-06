# Task management

Tasks are JSON in `.ai-team/backlog/tasks/T-NNN.json`, created and moved **only** with `ai_team.py` (it enforces the machine and evidence rules).

## State machine
`PENDING -> ASSIGNED -> IN_PROGRESS -> SUBMITTED -> IN_REVIEW -> APPROVED -> DONE`; side paths: `IN_PROGRESS|ASSIGNED|REVISION -> BLOCKED` (only with an open clarification; unblocked by a CONFIRMED answer, restoring the previous state), `SUBMITTED|IN_REVIEW -> REVISION -> IN_PROGRESS`, any early state `-> CANCELLED`.

Rules enforced by code: `IN_PROGRESS` needs all dependencies `DONE`; `SUBMITTED`, `APPROVED`, `DONE` need `--evidence`; only the orchestrator marks `DONE`, and never while related findings/bugs are unresolved.

## Task contract (every delegation prompt contains these)
Task ID, title, description, assigned agent (exactly one primary owner), input artifacts, dependencies, scope (in/out), acceptance criteria, expected outputs, status, related PR, related findings/bugs, requirement IDs.

```
python3 .ai-team/scripts/ai_team.py task new T-001 "Title" --owner ba --ac "criterion" --req REQ-001 --deps T-000 --inputs path --outputs path
python3 .ai-team/scripts/ai_team.py task move T-001 ASSIGNED
python3 .ai-team/scripts/ai_team.py task move T-001 SUBMITTED --evidence "<sha / report path / command output>" --by senior-fullstack-dev
```

## Review/bug records
`record new finding|bug --json {...}`; developer sets `FIXED_PENDING_VERIFICATION --sha <fix>`; only reviewer/tester close with `VERIFIED_CLOSED --verifier ... --sha <re-inspected sha> --evidence ...`. LOW items may be `DISPOSITIONED` with a reason. BLOCKER/HIGH/MEDIUM must be fixed.

## Loop limits
Review and bug-fix loops are capped in `.ai-team/config.json`. On non-convergence, stop and escalate to the Orchestrator's report; never loop forever or bypass a finding.

## Persistence
After every state change, commit `.ai-team/` on the feature branch at logical checkpoints so `/resume` can recover. Persisted state never overrides Git/GitHub evidence.
