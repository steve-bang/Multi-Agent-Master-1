---
name: client-clarification
description: Procedure for the Client agent to answer BA questions only from verified project information, classify each answer CONFIRMED/INFERRED/UNKNOWN, and prepare Project Owner escalations; and for the Orchestrator to run the clarification loop.
---

# Client clarification procedure

## Client agent
For each question:
1. Search `.ai-team/PROJECT.md`, `.ai-team/requirements/`, `.ai-team/decisions/`, `.ai-team/clarifications/answered/`, owner-supplied docs (Grep for key terms).
2. **CONFIRMED**: an approved source states it explicitly -> give answer + `SOURCE: path:line` + quoted text.
3. **INFERRED**: not stated but strongly implied -> give answer, the reasoning chain, and the confirming question. Label it INFERRED; it is *not* a requirement.
4. **UNKNOWN**: no reliable info -> say so. Never guess.
5. For INFERRED/UNKNOWN write `OWNER_QUESTION` (one sentence), `WHY_NEEDED`, `RECOMMENDED_DEFAULT`, `OPTIONS` (with consequences).
6. Report conflicting sources explicitly (both quotes).

## Orchestrator loop
1. `clarify new` (blocks dependent tasks only). 2. Route BA -> Client. 3. CONFIRMED -> `clarify answer --classification CONFIRMED --source <path>` (auto-unblocks). 4. INFERRED/UNKNOWN -> `clarify answer --classification INFERRED|UNKNOWN` (marks ESCALATED_TO_OWNER, tasks stay blocked); batch all escalations into one Owner message. 5. When the Owner replies, save the reply into `.ai-team/decisions/` (or PROJECT.md), then record it as CONFIRMED with that file as source. 6. BA updates requirements; resume tasks. Never ask the Owner something already answered.
