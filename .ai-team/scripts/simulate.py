#!/usr/bin/env python3
"""Safe end-to-end dry run of the AI-team workflow in a THROWAWAY git repo (never touches this repo's state).

What is EXECUTED: the real ai_team.py state machine, clarification loop, finding lifecycle, gates, resume,
a real git branch/commit in the temp repo, and one trivial real check command.
What is SIMULATED: everything an LLM agent would author or decide (BA content, Client answers, designs,
code, review judgments) and GitHub (no PR is created; no remote is touched).
Writes a report to .ai-team/reports/simulation/ (pass --out to change).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", ".."))
CLI = os.path.join(HERE, "ai_team.py")
log = []


def say(kind, step, text):
    log.append((kind, step, text))
    print("[%-9s] %2s %s" % (kind, step, text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(SRC, ".ai-team", "reports", "simulation", "simulation-report.md"))
    out = ap.parse_args().out
    d = tempfile.mkdtemp(prefix="aiteam-sim-")
    os.makedirs(os.path.join(d, ".ai-team"))
    shutil.copytree(os.path.join(SRC, ".ai-team", "state"), os.path.join(d, ".ai-team", "state"))
    cfg = json.load(open(os.path.join(SRC, ".ai-team", "config.json")))
    for k in cfg["checks"]:
        cfg["checks"][k]["command"] = None
    cfg["checks"]["build"]["command"] = "python3 -c \"print('trivial build ok')\""
    cfg["checks"]["lint"]["required"] = cfg["checks"]["unit"]["required"] = False
    json.dump(cfg, open(os.path.join(d, ".ai-team", "config.json"), "w"))

    def cli(*a, expect_ok=True):
        r = subprocess.run([sys.executable, CLI, "--root", d] + list(a), capture_output=True, text=True)
        if (r.returncode == 0) != expect_ok:
            print(r.stdout, r.stderr)
            raise SystemExit("simulation step failed: %s" % (a,))
        return (r.stdout + r.stderr).strip()

    def git(*a):
        return subprocess.run(["git", "-c", "user.email=sim@example.invalid", "-c", "user.name=sim"] + list(a),
                              cwd=d, capture_output=True, text=True, check=True).stdout.strip()

    git("init", "-q", "-b", "main")
    git("commit", "-q", "--allow-empty", "-m", "sim: initial")
    say("SIMULATED", 1, "Project Owner idea: 'Add a contact form that emails the sales team' (fictional)")
    git("switch", "-q", "-c", "ai/sim-contact-form")
    cli("feature", "new", "sim-contact-form", "--branch", "ai/sim-contact-form")
    say("EXECUTED", 2, "Orchestrator intake: feature record + real git branch ai/sim-contact-form in temp repo")
    cli("task", "new", "T-001", "Requirements for contact form", "--owner", "ba", "--ac", "REQ list with statuses", "--req", "REQ-001")
    cli("task", "new", "T-002", "Design contact form", "--owner", "designer", "--ac", "spec with all states", "--deps", "T-001", "--req", "REQ-001")
    cli("task", "new", "T-003", "Implement contact form", "--owner", "senior-fullstack-dev", "--ac", "form submits", "--deps", "T-002", "--req", "REQ-001")
    cli("task", "move", "T-001", "ASSIGNED"); cli("task", "move", "T-001", "IN_PROGRESS")
    say("SIMULATED", 3, "BA drafted requirements; found gap: which recipient address receives submissions?")
    cid = cli("clarify", "new", "Which email address receives submissions?", "--asked-by", "ba", "--route", "client", "--blocks", "T-001")
    cli("handoff", "--from", "ba", "--to", "client", "--task", "T-001", "--type", "question", "--summary", cid)
    say("EXECUTED", 4, "Clarification %s created; T-001 -> BLOCKED (tooling verified)" % cid)
    say("SIMULATED", 5, "Client searched PROJECT.md: no address found -> UNKNOWN")
    print("            ", cli("clarify", "answer", cid, "--classification", "UNKNOWN", "--answer", "no source found"))
    cli("task", "move", "T-001", "SUBMITTED", "--evidence", "x", expect_ok=False)
    say("EXECUTED", 5, "UNKNOWN escalated to Owner; task correctly stays BLOCKED (illegal move rejected)")
    say("SIMULATED", 6, "Owner replied: sales@example.invalid. Recorded as CONFIRMED with source decisions/owner-001.md")
    cli("clarify", "answer", cid, "--classification", "CONFIRMED", "--answer", "sales@example.invalid", "--source", ".ai-team/decisions/owner-001.md")
    cli("task", "move", "T-001", "SUBMITTED", "--evidence", "requirements/sim.md (simulated)", "--by", "ba")
    cli("task", "move", "T-001", "IN_REVIEW"); cli("task", "move", "T-001", "APPROVED", "--evidence", "orchestrator check")
    cli("task", "move", "T-001", "DONE", "--evidence", "requirements approved")
    say("EXECUTED", 6, "Clarification answered -> T-001 unblocked and completed through the state machine")
    cli("task", "move", "T-002", "ASSIGNED"); cli("task", "move", "T-002", "IN_PROGRESS")
    say("SIMULATED", 7, "Designer produced design spec (flow, states, responsive, a11y)")
    cli("task", "move", "T-002", "SUBMITTED", "--evidence", "design-specs/sim.md (simulated)", "--by", "designer")
    cli("task", "move", "T-002", "IN_REVIEW"); cli("task", "move", "T-002", "APPROVED", "--evidence", "ok")
    cli("task", "move", "T-002", "DONE", "--evidence", "spec accepted")
    cli("task", "move", "T-003", "ASSIGNED"); cli("task", "move", "T-003", "IN_PROGRESS")
    with open(os.path.join(d, "form.txt"), "w") as f:
        f.write("placeholder implementation\n")
    git("add", "form.txt"); git("commit", "-q", "-m", "T-003 REQ-001: add form placeholder")
    sha1 = git("rev-parse", "HEAD")
    say("EXECUTED", 8, "Developer step: real commit %s on ai/sim-contact-form in temp repo (content is a placeholder; NO push, NO PR)" % sha1[:8])
    cli("feature", "set", "sim-contact-form", "--pr", "SIM-PR", "--head-sha", sha1)
    cli("task", "move", "T-003", "SUBMITTED", "--evidence", "commit " + sha1, "--by", "senior-fullstack-dev")
    cli("task", "move", "T-003", "IN_REVIEW")
    say("SIMULATED", 9, "GitHub PR creation skipped (PR id SIM-PR is a placeholder; no remote exists)")
    say("EXECUTED", 10, "Tester check run: " + cli("run-checks").replace("\n", " | ")[:140])
    say("SIMULATED", 10, "Tester functional/authz scenarios (not executed; no real code exists)")
    fnd = json.dumps({"pr": "SIM-PR", "sha": sha1, "severity": "MEDIUM", "category": "validation", "file": "form.txt", "line": 1,
                      "description": "No input validation (simulated)", "expected": "Validate email", "action": "Add validation",
                      "acceptance": "Invalid email rejected", "task": "T-003"})
    fid = cli("record", "new", "finding", "--json", fnd)
    say("SIMULATED", 11, "Reviewer judgment: sample MEDIUM finding. EXECUTED: record %s created" % fid)
    cli("task", "move", "T-003", "REVISION")
    with open(os.path.join(d, "form.txt"), "a") as f:
        f.write("validation added\n")
    git("commit", "-q", "-am", "T-003 %s: validate input" % fid)
    sha2 = git("rev-parse", "HEAD")
    cli("record", "update", fid, "--status", "FIXED_PENDING_VERIFICATION", "--sha", sha2)
    say("EXECUTED", 12, "Developer fix commit %s; record -> FIXED_PENDING_VERIFICATION (not closed)" % sha2[:8])
    cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "senior-fullstack-dev", "--sha", sha2, "--evidence", "x", expect_ok=False)
    say("EXECUTED", 13, "Developer self-closing attempt rejected by tooling")
    cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "reviewer", "--sha", sha2, "--evidence", "re-inspected git diff %s..%s (simulated judgment)" % (sha1[:8], sha2[:8]))
    say("EXECUTED", 13, "Reviewer verification recorded against the new SHA")
    cli("feature", "set", "sim-contact-form", "--head-sha", sha2)
    cli("task", "move", "T-003", "IN_PROGRESS"); cli("task", "move", "T-003", "SUBMITTED", "--evidence", "fix " + sha2)
    cli("task", "move", "T-003", "IN_REVIEW"); cli("task", "move", "T-003", "APPROVED", "--evidence", "re-review ok")
    cli("task", "move", "T-003", "DONE", "--evidence", "fix verified at " + sha2)
    gate_names = ["requirements_implemented", "acceptance_criteria_pass", "tester_no_blocking_bugs",
                  "reviewer_no_actionable_findings", "ci_checks_pass", "build_succeeds", "regression_pass",
                  "no_merge_conflicts", "targets_main", "final_sha_validated"]
    cli("gate", "sim-contact-form", "build_succeeds", "pass", "--sha", sha2, "--evidence", "run-checks (trivial command)")
    out14 = cli("gates", "sim-contact-form", expect_ok=False)
    say("EXECUTED", 14, "Gate check with only 1/10 gates recorded -> NOT_READY as required (%d reasons)" % (out14.count("\n")))
    for g in gate_names:
        if g != "build_succeeds":
            cli("gate", "sim-contact-form", g, "pass", "--sha", sha2, "--evidence", "SIMULATED evidence (nothing real was validated)")
    final = cli("gates", "sim-contact-form")
    say("EXECUTED", 14, "Gate logic with all gates recorded (evidence is simulated): " + final.split(" (")[0])
    cli("validate-state")
    say("EXECUTED", 15, "State validated; resume summary: " + cli("resume", "--brief").splitlines()[2])
    shutil.rmtree(d)

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Simulation report (dry run)\n\n"
                "**This is a simulation.** It ran in a temporary git repository that was deleted afterwards. "
                "`EXECUTED` = the real workflow tooling ran and was checked. `SIMULATED` = an agent action or "
                "external system that was NOT performed (no real code, tests, GitHub PR, or Owner conversation). "
                "No real PR exists; passing gates here prove the tooling's logic, not any product quality.\n\n"
                "| Kind | Step | What happened |\n|---|---|---|\n")
        for k, s, t in log:
            f.write("| %s | %s | %s |\n" % (k, s, t.replace("|", "/")))
    print("\nOK - report written to", out)


if __name__ == "__main__":
    main()
