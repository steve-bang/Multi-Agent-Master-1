# .ai-team workspace

Git-tracked source of truth for the AI team.

| Path | Contents |
|---|---|
| `PROJECT.md`, `config.json` | charter + Owner authorizations; branch/check/loop config |
| `state/` | `workflow.json` (features, phases, gates), `agent-status.json`, `handoffs.jsonl` |
| `backlog/` | `epics/*.md`, `tasks/T-NNN.json` (state machine) |
| `requirements/` | BRD, `REQ-NNN` requirements, stories, acceptance criteria |
| `design/`, `architecture/` | UX flows/specs; technical designs and API contracts |
| `clarifications/` | `open-questions/`, `answered/` (CLR-NNN.json) |
| `testing/` | test plans/results, `bug-reports/BUG-NNN.json` |
| `reviews/` | `findings/FND-NNN.json`, review reports |
| `decisions/` | ADRs and Owner decisions |
| `reports/` | milestone, final, and simulation reports |
| `templates/` | requirement, task, report templates |
| `scripts/` | `ai_team.py` (state machine/gates/resume), `validate_config.py`, `simulate.py`, tests |

Workflow: Owner idea -> Orchestrator intake -> BA (<-> Client <-> Owner) -> Designer -> Developer plan -> implement -> Tester || Reviewer -> fix loops -> gates -> READY_FOR_OWNER_APPROVAL. Owner merges.
