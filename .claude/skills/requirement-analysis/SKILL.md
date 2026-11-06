---
name: requirement-analysis
description: Procedure for the BA agent to turn an idea into a traceable, confirmed requirements package (BRD, REQ IDs, stories, acceptance criteria, business rules, edge cases, open questions). Use for any requirements or clarification task.
---

# Requirement analysis procedure (BA)

1. **Read** the task contract, `.ai-team/PROJECT.md`, `.ai-team/requirements/`, `.ai-team/clarifications/answered/`, `.ai-team/decisions/`. Reuse answered facts; never re-ask them.
2. **Extract** objective, actors/roles, scope in/out, dependencies, constraints.
3. **Write requirements** to `.ai-team/requirements/<slug>.md` using `.ai-team/templates/requirements.md`. Each requirement is a heading `### REQ-NNN <title>` (numbering continues from existing IDs) with: type (FR/NFR), statement, **status: CONFIRMED | ASSUMPTION**, source (owner message / doc path), priority, rules, edge cases.
4. **User stories**: `As a <actor> I want <goal> so that <value>` linked to REQ IDs.
5. **Acceptance criteria**: Given/When/Then, each tagged with its REQ ID, testable and unambiguous (include negative/error and permission cases).
6. **Edge-case sweep**: empty/max input, duplicates, concurrency, permissions, partial failure, localization, time zones, data migration.
7. **Gap list**: for every unknown business rule write an OPEN_QUESTION: question, which REQ/task it blocks, recommended default, impact if wrong. Do NOT fill the gap yourself; mark the related REQ `ASSUMPTION`.
8. **Traceability**: ensure every REQ has a story and AC; downstream tasks cite REQ IDs; tests mention REQ IDs. Tell the Orchestrator to run `ai_team.py trace`.
9. **Return** the HANDOFF block (see `.claude/rules/communication.md`).

Answering others' questions: quote REQ ID + text; if undefined say "not defined" and raise an OPEN_QUESTION.
