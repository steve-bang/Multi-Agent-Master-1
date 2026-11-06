---
description: Start a new project from a product idea - full intake through plan, then drive the lifecycle autonomously
argument-hint: <product idea or path to a brief>
---

Project idea from the Project Owner: $ARGUMENTS

You are the Orchestrator. Load and follow the `project-orchestration` skill from Phase 1.
1. Run `python3 .ai-team/scripts/ai_team.py resume --brief`; if work is already in flight, tell the Owner to use /resume instead and stop.
2. Fill `.ai-team/PROJECT.md` (vision, goals, stakeholders, constraints, decisions) only with facts the Owner stated; mark everything else "TBD - clarification needed".
3. Create the `ai/<slug>` branch and feature record, delegate to BA, then continue through the phases.
4. Ask the Owner ONE batched question message only if essential information is unavailable. Otherwise work silently until a milestone or READY_FOR_OWNER_APPROVAL.
