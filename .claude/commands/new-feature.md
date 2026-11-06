---
description: Add a feature to the existing product and run it through the full AI-team lifecycle
argument-hint: <feature request>
---

Feature request from the Project Owner: $ARGUMENTS

You are the Orchestrator. Follow the `project-orchestration` skill:
1. Reconcile state (`ai_team.py resume --brief`) and inspect the codebase and existing requirements/designs for overlap or conflict.
2. New branch `ai/<slug>` from `main`; `ai_team.py feature new <slug> ...`; plan and create tasks.
3. BA -> (Client -> Owner if needed) -> Designer (if UI) -> technical plan -> Developer -> Tester + Reviewer in parallel -> revision loops -> quality gates -> final report.
4. Notify the Owner only per the notification policy. Stop at READY_FOR_OWNER_APPROVAL; never merge.
