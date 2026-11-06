# Communication protocol

Subagents cannot message each other or the Project Owner. **All communication is Orchestrator-mediated handoffs.** Every handoff is recorded:

```
python3 .ai-team/scripts/ai_team.py handoff --from <agent> --to <agent|owner> --task T-001 --type <type> --summary "<one line>"
```
Types: `delegation`, `report`, `question`, `answer`, `bug`, `finding`, `blocker`, `escalation`.

## Routing table
| From | To | Content |
|---|---|---|
| Developer / Designer / Tester | BA | business / requirement / acceptance-criteria clarification |
| BA | Client | business clarification |
| Client | Project Owner (via Orchestrator) | UNKNOWN / INFERRED / conflicting items |
| Reviewer | Developer (via Orchestrator) | findings |
| Tester | Developer (via Orchestrator) | bug reports |
| Developer | Orchestrator | technical blockers, implementation reports |
| BA | Orchestrator | requirements complete, unresolved questions |

## Required subagent report format
Every subagent ends with a block the Orchestrator can parse:
```
HANDOFF
FROM: <agent>   TASK: <T-id>   STATUS: DONE | BLOCKED | NEEDS_INFO | FAILED
SHA: <commit sha or n/a>
ARTIFACTS: <paths>
EVIDENCE: <exact commands + results, or report paths>
OPEN_QUESTIONS: <numbered; each states blocked REQ/task and a recommended default>
ASSUMPTIONS: <list or none>
NEXT: <suggested next step for the Orchestrator>
```

## Blocking questions
1. `clarify new "<question>" --asked-by <agent> --route ba|client|owner --blocks T-xxx` (sets tasks BLOCKED, creates a clarification record).
2. Route it (BA -> Client -> Owner as needed).
3. Record the answer: `clarify answer CLR-xxx --classification CONFIRMED|INFERRED|UNKNOWN --answer "..." --source <path>`; only CONFIRMED with a source unblocks tasks.
4. Update requirements/decisions, resume the affected tasks. Unrelated tasks continue meanwhile.

Never silently discard a request or response.
