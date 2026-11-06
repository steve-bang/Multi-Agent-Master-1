"""Tests for ai_team.py: state machine, evidence rules, clarifications, records, gates, resume."""
import json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "ai_team.py")
SRC = os.path.abspath(os.path.join(HERE, "..", ".."))


class Base(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.d, ".ai-team"))
        for sub in ("state",):
            shutil.copytree(os.path.join(SRC, ".ai-team", sub), os.path.join(self.d, ".ai-team", sub))
        shutil.copy(os.path.join(SRC, ".ai-team", "config.json"), os.path.join(self.d, ".ai-team", "config.json"))
        subprocess.run(["git", "init", "-q", "-b", "ai/test"], cwd=self.d)

    def tearDown(self):
        shutil.rmtree(self.d)

    def run_cli(self, *args, ok=True):
        r = subprocess.run([sys.executable, SCRIPT, "--root", self.d] + list(args), capture_output=True, text=True)
        if ok:
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        else:
            self.assertNotEqual(r.returncode, 0, "expected failure: " + r.stdout)
        return r.stdout + r.stderr

    def task(self, tid, owner="ba", **kw):
        args = ["task", "new", tid, "T " + tid, "--owner", owner, "--ac", "ac"]
        for d in kw.get("deps", []):
            args += ["--deps", d]
        self.run_cli(*args)


class TestTasks(Base):
    def test_happy_path_and_evidence(self):
        self.task("T-001")
        self.run_cli("task", "move", "T-001", "ASSIGNED")
        self.run_cli("task", "move", "T-001", "IN_PROGRESS")
        self.run_cli("task", "move", "T-001", "SUBMITTED", ok=False)  # no evidence
        self.run_cli("task", "move", "T-001", "SUBMITTED", "--evidence", "report.md")
        self.run_cli("task", "move", "T-001", "IN_REVIEW")
        self.run_cli("task", "move", "T-001", "APPROVED", "--evidence", "ok")
        self.run_cli("task", "move", "T-001", "DONE", "--evidence", "x", "--by", "tester", ok=False)
        self.run_cli("task", "move", "T-001", "DONE", "--evidence", "x")

    def test_illegal_transition_and_dependencies(self):
        self.task("T-001")
        self.task("T-002", deps=["T-001"])
        self.run_cli("task", "move", "T-001", "DONE", "--evidence", "x", ok=False)
        self.run_cli("task", "move", "T-002", "ASSIGNED")
        self.run_cli("task", "move", "T-002", "IN_PROGRESS", ok=False)  # dep not DONE

    def test_ac_required(self):
        self.run_cli("task", "new", "T-009", "x", "--owner", "ba", ok=False)


class TestClarify(Base):
    def test_block_and_unblock_only_on_confirmed(self):
        self.task("T-001"); self.task("T-002")
        self.run_cli("task", "move", "T-001", "ASSIGNED")
        out = self.run_cli("clarify", "new", "Who approves?", "--asked-by", "ba", "--route", "client", "--blocks", "T-001")
        cid = out.strip()
        self.assertIn("BLOCKED", self.run_cli("task", "list"))
        self.run_cli("clarify", "answer", cid, "--classification", "INFERRED", "--answer", "manager")
        self.assertIn("BLOCKED", self.run_cli("task", "list", "--status", "BLOCKED"))
        self.run_cli("clarify", "answer", cid, "--classification", "CONFIRMED", "--answer", "manager", ok=False)  # no source
        self.run_cli("clarify", "answer", cid, "--classification", "CONFIRMED", "--answer", "manager", "--source", "PROJECT.md:3")
        out = self.run_cli("task", "list")
        self.assertIn("ASSIGNED", out.split("T-001")[1].split("\n")[0])
        self.assertTrue(os.path.exists(os.path.join(self.d, ".ai-team/clarifications/answered", cid + ".json")))

    def test_unrelated_task_not_blocked(self):
        self.task("T-001"); self.task("T-002")
        self.run_cli("task", "move", "T-001", "ASSIGNED"); self.run_cli("task", "move", "T-002", "ASSIGNED")
        self.run_cli("clarify", "new", "q", "--asked-by", "ba", "--route", "owner", "--blocks", "T-001")
        out = self.run_cli("task", "list", "--status", "ASSIGNED")
        self.assertIn("T-002", out); self.assertNotIn("T-001", out)


FINDING = json.dumps({"pr": 7, "sha": "aaa111", "severity": "HIGH", "category": "security", "file": "a.py",
                      "line": 3, "description": "d", "expected": "e", "action": "a", "acceptance": "c", "task": "T-001"})


class TestRecordsAndGates(Base):
    def test_finding_cannot_be_closed_by_developer_claim(self):
        self.task("T-001", owner="senior-fullstack-dev")
        fid = self.run_cli("record", "new", "finding", "--json", FINDING).strip()
        self.run_cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "reviewer",
                     "--sha", "bbb222", "--evidence", "e", ok=False)  # not fixed yet
        self.run_cli("record", "update", fid, "--status", "FIXED_PENDING_VERIFICATION", "--sha", "bbb222")
        self.run_cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "senior-fullstack-dev",
                     "--sha", "bbb222", "--evidence", "e", ok=False)
        self.run_cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "reviewer",
                     "--sha", "aaa111", "--evidence", "e", ok=False)  # same sha as original
        self.run_cli("record", "update", fid, "--status", "VERIFIED_CLOSED", "--verifier", "reviewer",
                     "--sha", "bbb222", "--evidence", "diff checked")

    def test_high_cannot_be_dispositioned_and_blocks_done(self):
        self.task("T-001", owner="senior-fullstack-dev")
        fid = self.run_cli("record", "new", "finding", "--json", FINDING).strip()
        self.run_cli("record", "update", fid, "--status", "DISPOSITIONED", "--disposition", "meh", ok=False)
        for s in ("ASSIGNED", "IN_PROGRESS"):
            self.run_cli("task", "move", "T-001", s)
        for s in ("SUBMITTED", "IN_REVIEW", "APPROVED"):
            self.run_cli("task", "move", "T-001", s, "--evidence", "e")
        self.assertIn("unresolved", self.run_cli("task", "move", "T-001", "DONE", "--evidence", "e", ok=False))

    def test_incomplete_record_rejected(self):
        self.run_cli("record", "new", "finding", "--json", '{"pr":1,"sha":"a","severity":"HIGH"}', ok=False)

    def test_gates_require_all_and_current_sha(self):
        self.run_cli("feature", "new", "f", "--branch", "ai/f")
        self.assertIn("NOT_READY", self.run_cli("gates", "f", ok=False))
        self.run_cli("feature", "set", "f", "--pr", "7", "--head-sha", "s1")
        for g in ["requirements_implemented", "acceptance_criteria_pass", "tester_no_blocking_bugs",
                  "reviewer_no_actionable_findings", "ci_checks_pass", "build_succeeds", "regression_pass",
                  "no_merge_conflicts", "targets_main", "final_sha_validated"]:
            self.run_cli("gate", "f", g, "pass", "--sha", "s1", "--evidence", "proof")
        self.assertIn("READY_FOR_OWNER_APPROVAL", self.run_cli("gates", "f"))
        self.run_cli("feature", "set", "f", "--head-sha", "s2")  # new commit -> stale
        self.assertIn("stale", self.run_cli("gates", "f", ok=False))
        self.run_cli("feature", "set", "f", "--head-sha", "s1")
        self.task("T-001", owner="senior-fullstack-dev")
        self.run_cli("record", "new", "finding", "--json", FINDING)
        self.assertIn("unresolved findings", self.run_cli("gates", "f", ok=False))


class TestMisc(Base):
    def test_run_checks_unconfigured_fails(self):
        self.assertIn("NOT_CONFIGURED", self.run_cli("run-checks", ok=False))

    def test_handoff_and_resume_and_validate(self):
        self.run_cli("handoff", "--from", "ba", "--to", "orchestrator", "--type", "report", "--summary", "x")
        self.run_cli("handoff", "--from", "nobody", "--to", "orchestrator", "--type", "report", "--summary", "x", ok=False)
        out = self.run_cli("resume")
        self.assertIn("AI TEAM RESUME", out)
        self.run_cli("validate-state")

    def test_resume_flags_branch_mismatch(self):
        subprocess.run(["git", "-c", "user.email=a@b", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "i"], cwd=self.d)
        self.run_cli("feature", "new", "f", "--branch", "ai/test")
        self.run_cli("feature", "set", "f", "--head-sha", "deadbeef")
        self.assertIn("RECONCILE", self.run_cli("resume", "--brief"))

    def test_trace_gaps(self):
        os.makedirs(os.path.join(self.d, ".ai-team/requirements"))
        with open(os.path.join(self.d, ".ai-team/requirements/r.md"), "w") as f:
            f.write("### REQ-001 x\n### REQ-002 y\n")
        self.run_cli("trace", "--strict", ok=False)


if __name__ == "__main__":
    unittest.main()
