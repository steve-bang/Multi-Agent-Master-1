#!/usr/bin/env python3
"""ai_team.py - deterministic workflow-state tooling for the Claude multi-agent team.

Stdlib only. State lives in git-tracked JSON/Markdown under .ai-team/.
The Orchestrator (main Claude Code session) calls this instead of hand-editing
state so that the state machine, evidence rules and gates are enforced by code,
not by LLM statements.

Usage: python3 .ai-team/scripts/ai_team.py [--root DIR] <command> ...
Commands: task, clarify, record, handoff, feature, gate, gates, trace,
          resume, validate-state, agent-status, run-checks
"""
import argparse, datetime, glob, json, os, re, subprocess, sys

AGENTS = ["orchestrator", "ba", "designer", "senior-fullstack-dev", "tester", "reviewer", "client"]
STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "SUBMITTED", "IN_REVIEW",
            "REVISION", "APPROVED", "DONE", "CANCELLED"]
TRANSITIONS = {
    "PENDING": {"ASSIGNED", "CANCELLED"},
    "ASSIGNED": {"IN_PROGRESS", "BLOCKED", "CANCELLED"},
    "IN_PROGRESS": {"BLOCKED", "SUBMITTED", "CANCELLED"},
    "BLOCKED": {"CANCELLED"},          # leaving BLOCKED is only via `clarify answer` (restores prev status)
    "SUBMITTED": {"IN_REVIEW", "REVISION"},
    "IN_REVIEW": {"APPROVED", "REVISION"},
    "REVISION": {"IN_PROGRESS", "BLOCKED"},
    "APPROVED": {"DONE"},
    "DONE": set(),
    "CANCELLED": set(),
}
GATES = ["requirements_implemented", "acceptance_criteria_pass", "tester_no_blocking_bugs",
         "reviewer_no_actionable_findings", "ci_checks_pass", "build_succeeds",
         "regression_pass", "no_merge_conflicts", "targets_main", "final_sha_validated"]
SEVERITIES = ["BLOCKER", "HIGH", "MEDIUM", "LOW"]
RECORD_KINDS = {
    "finding": {"prefix": "FND", "dir": "reviews/findings",
                "required": ["pr", "sha", "severity", "category", "file", "description",
                             "expected", "action", "acceptance"]},
    "bug": {"prefix": "BUG", "dir": "testing/bug-reports",
            "required": ["task", "sha", "severity", "title", "steps", "expected", "actual"]},
}
CLOSED_RECORD = {"VERIFIED_CLOSED", "DISPOSITIONED"}
TASK_REQUIRED = ["id", "title", "description", "assigned_agent", "input_artifacts", "dependencies",
                 "scope", "acceptance_criteria", "expected_outputs", "status", "related_pr",
                 "related_findings", "related_bugs"]


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def die(msg, code=1):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(code)


class Ctx:
    def __init__(self, root):
        self.root = root

    def p(self, *parts):
        return os.path.join(self.root, ".ai-team", *parts)

    def load(self, path, default=None):
        if not os.path.exists(path):
            if default is not None:
                return default
            die("missing file " + path)
        with open(path, encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError as e:
                die("invalid JSON in %s: %s" % (path, e))

    def save(self, path, obj):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2, sort_keys=False)
            f.write("\n")
        os.replace(tmp, path)

    def task_path(self, tid):
        return self.p("backlog", "tasks", tid + ".json")

    def tasks(self):
        out = []
        for f in sorted(glob.glob(self.p("backlog", "tasks", "*.json"))):
            out.append(self.load(f))
        return out

    def records(self, kind):
        d = self.p(RECORD_KINDS[kind]["dir"])
        return [self.load(f) for f in sorted(glob.glob(os.path.join(d, "*.json")))]

    def clarifications(self):
        out = []
        for sub in ("open-questions", "answered"):
            for f in sorted(glob.glob(self.p("clarifications", sub, "*.json"))):
                out.append(self.load(f))
        return out

    def workflow(self):
        return self.load(self.p("state", "workflow.json"))


def find_root(arg):
    if arg:
        return os.path.abspath(arg)
    if os.environ.get("AI_TEAM_ROOT"):
        return os.path.abspath(os.environ["AI_TEAM_ROOT"])
    d = os.getcwd()
    while True:
        if os.path.isdir(os.path.join(d, ".ai-team")):
            return d
        if os.path.dirname(d) == d:
            die("cannot locate .ai-team/ (use --root)")
        d = os.path.dirname(d)


def sh(cmd, cwd):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=60)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, "", str(e)


def next_id(ctx, prefix, folder_globs):
    nums = [0]
    for g in folder_globs:
        for f in glob.glob(g):
            m = re.match(r"%s-(\d+)" % prefix, os.path.basename(f))
            if m:
                nums.append(int(m.group(1)))
    return "%s-%03d" % (prefix, max(nums) + 1)


# ---------------------------------------------------------------- tasks
def task_new(ctx, a):
    if not re.match(r"^T-\d{3,}$", a.id):
        die("task id must look like T-001")
    if a.owner not in AGENTS:
        die("owner must be one of %s" % AGENTS)
    path = ctx.task_path(a.id)
    if os.path.exists(path):
        die("task exists: " + a.id)
    for d in a.deps or []:
        if not os.path.exists(ctx.task_path(d)):
            die("unknown dependency " + d)
    if not a.ac:
        die("at least one --ac acceptance criterion is required")
    t = {"id": a.id, "title": a.title, "description": a.description or a.title,
         "assigned_agent": a.owner, "input_artifacts": a.inputs or [],
         "dependencies": a.deps or [], "scope": a.scope or "", "acceptance_criteria": a.ac,
         "expected_outputs": a.outputs or [], "status": "PENDING", "related_pr": None,
         "related_findings": [], "related_bugs": [], "requirements": a.req or [],
         "blocked_by": [], "prev_status": None, "evidence": [],
         "history": [{"at": now(), "to": "PENDING", "by": "orchestrator"}]}
    ctx.save(path, t)
    print("created " + a.id)


def set_status(t, new, by, note=None):
    t["history"].append({"at": now(), "from": t["status"], "to": new, "by": by, "note": note})
    t["status"] = new


def task_move(ctx, a):
    path = ctx.task_path(a.id)
    t = ctx.load(path)
    new = a.status
    if new not in STATUSES:
        die("unknown status " + new)
    if new not in TRANSITIONS[t["status"]]:
        die("illegal transition %s -> %s (allowed: %s)" %
            (t["status"], new, sorted(TRANSITIONS[t["status"]]) or "none"))
    by = a.by or "orchestrator"
    if new in ("SUBMITTED", "APPROVED", "DONE") and not a.evidence:
        die("%s requires --evidence (command output, commit SHA, report path)" % new)
    if new == "IN_PROGRESS":
        for d in t["dependencies"]:
            dt = ctx.load(ctx.task_path(d))
            if dt["status"] != "DONE":
                die("dependency %s is %s, not DONE" % (d, dt["status"]))
    if new == "BLOCKED":
        if not a.blocked_by:
            die("BLOCKED requires --blocked-by <CLR-id>")
        for c in a.blocked_by:
            if not os.path.exists(ctx.p("clarifications", "open-questions", c + ".json")):
                die("clarification %s is not open; create it with `clarify new`" % c)
        t["prev_status"] = t["status"]
        t["blocked_by"] = a.blocked_by
    if new == "DONE":
        if by != "orchestrator":
            die("only the orchestrator may mark a task DONE")
        for kind, key in (("finding", "related_findings"), ("bug", "related_bugs")):
            open_ids = [r["id"] for r in ctx.records(kind)
                        if r["id"] in t[key] and r["status"] not in CLOSED_RECORD]
            if open_ids:
                die("cannot mark DONE; unresolved %s: %s" % (kind, open_ids))
    if a.pr:
        t["related_pr"] = a.pr
    if a.evidence:
        t["evidence"].append({"at": now(), "by": by, "evidence": a.evidence})
    set_status(t, new, by, a.note)
    ctx.save(path, t)
    print("%s -> %s" % (a.id, new))


def task_list(ctx, a):
    for t in ctx.tasks():
        if a.status and t["status"] != a.status:
            continue
        print("%-8s %-12s %-22s %s" % (t["id"], t["status"], t["assigned_agent"], t["title"]))


# --------------------------------------------------------- clarifications
def clarify_new(ctx, a):
    if a.route not in ("ba", "client", "owner"):
        die("route must be ba|client|owner")
    cid = next_id(ctx, "CLR", [ctx.p("clarifications", s, "CLR-*.json") for s in ("open-questions", "answered")])
    rec = {"id": cid, "question": a.question, "asked_by": a.asked_by, "route": a.route,
           "blocks": a.blocks or [], "status": "OPEN", "classification": None,
           "answer": None, "source": None, "created": now(), "history": []}
    ctx.save(ctx.p("clarifications", "open-questions", cid + ".json"), rec)
    for tid in rec["blocks"]:
        t = ctx.load(ctx.task_path(tid))
        if t["status"] in ("DONE", "CANCELLED"):
            die("cannot block finished task " + tid)
        if t["status"] != "BLOCKED":
            if "BLOCKED" not in TRANSITIONS[t["status"]]:
                die("task %s (%s) cannot be BLOCKED" % (tid, t["status"]))
            t["prev_status"] = t["status"]
            set_status(t, "BLOCKED", "orchestrator", "waiting on " + cid)
        t["blocked_by"] = sorted(set(t["blocked_by"] + [cid]))
        ctx.save(ctx.task_path(tid), t)
    print(cid)


def clarify_answer(ctx, a):
    path = ctx.p("clarifications", "open-questions", a.id + ".json")
    rec = ctx.load(path)
    rec["history"].append({"at": now(), "classification": a.classification, "answer": a.answer})
    if a.classification == "CONFIRMED":
        if not a.source:
            die("CONFIRMED answers require --source (document path or owner message reference)")
        rec.update(status="ANSWERED", classification="CONFIRMED", answer=a.answer,
                   source=a.source, answered=now())
        ctx.save(ctx.p("clarifications", "answered", a.id + ".json"), rec)
        os.remove(path)
        for t in ctx.tasks():
            if a.id in t.get("blocked_by", []):
                t["blocked_by"].remove(a.id)
                if not t["blocked_by"] and t["status"] == "BLOCKED":
                    set_status(t, t["prev_status"] or "PENDING", "orchestrator", "unblocked by " + a.id)
                    t["prev_status"] = None
                ctx.save(ctx.task_path(t["id"]), t)
        print("%s CONFIRMED; dependent tasks unblocked" % a.id)
    elif a.classification in ("INFERRED", "UNKNOWN"):
        rec.update(status="ESCALATED_TO_OWNER", classification=a.classification, route="owner")
        ctx.save(path, rec)
        print("%s is %s -> escalated to Project Owner; blocked tasks stay BLOCKED" % (a.id, a.classification))
    else:
        die("classification must be CONFIRMED|INFERRED|UNKNOWN")


def clarify_list(ctx, a):
    for c in ctx.clarifications():
        if a.all or c["status"] != "ANSWERED":
            print("%-8s %-20s route=%-6s blocks=%s  %s" %
                  (c["id"], c["status"], c["route"], ",".join(c["blocks"]) or "-", c["question"]))


# ------------------------------------------------------ findings and bugs
def record_new(ctx, a):
    spec = RECORD_KINDS[a.kind]
    try:
        data = json.loads(a.json)
    except json.JSONDecodeError as e:
        die("--json is not valid JSON: %s" % e)
    missing = [k for k in spec["required"] if not data.get(k)]
    if missing:
        die("missing required fields: %s" % missing)
    if data["severity"] not in SEVERITIES:
        die("severity must be one of %s" % SEVERITIES)
    rid = next_id(ctx, spec["prefix"], [ctx.p(spec["dir"], spec["prefix"] + "-*.json")])
    data.update(id=rid, kind=a.kind, status="OPEN", created=now(), original_sha=data["sha"], history=[])
    ctx.save(ctx.p(spec["dir"], rid + ".json"), data)
    key = {"finding": "related_findings", "bug": "related_bugs"}[a.kind]
    tid = data.get("task")
    if tid and os.path.exists(ctx.task_path(tid)):
        t = ctx.load(ctx.task_path(tid))
        t[key].append(rid)
        ctx.save(ctx.task_path(tid), t)
    print(rid)


def record_update(ctx, a):
    kind = {"FND": "finding", "BUG": "bug"}.get(a.id.split("-")[0])
    if not kind:
        die("record id must start with FND- or BUG-")
    path = ctx.p(RECORD_KINDS[kind]["dir"], a.id + ".json")
    r = ctx.load(path)
    if r["status"] in CLOSED_RECORD:
        die("%s is already closed" % a.id)
    st = a.status
    if st == "FIXED_PENDING_VERIFICATION":
        if not a.sha:
            die("--sha of the fixing commit is required")
        r["fixed_sha"] = a.sha
    elif st == "VERIFIED_CLOSED":
        if r["status"] != "FIXED_PENDING_VERIFICATION":
            die("must be FIXED_PENDING_VERIFICATION first (developer claims alone never close a record)")
        if a.verifier not in ("reviewer", "tester"):
            die("--verifier must be reviewer or tester (independent verification)")
        if not a.sha or a.sha == r["original_sha"]:
            die("--sha must be the commit you actually re-inspected, and differ from the original SHA")
        if not a.evidence:
            die("--evidence of re-verification is required")
        r.update(verified_by=a.verifier, verified_sha=a.sha)
    elif st == "DISPOSITIONED":
        if r["severity"] != "LOW":
            die("only LOW records may be dispositioned; fix %s items" % r["severity"])
        if not a.disposition:
            die("--disposition text required")
        r["disposition"] = a.disposition
    elif st == "OPEN":
        pass  # reopen after failed verification
    else:
        die("status must be OPEN|FIXED_PENDING_VERIFICATION|VERIFIED_CLOSED|DISPOSITIONED")
    r["history"].append({"at": now(), "from": r["status"], "to": st, "sha": a.sha, "evidence": a.evidence})
    r["status"] = st
    ctx.save(path, r)
    print("%s -> %s" % (a.id, st))


# ---------------------------------------------------------------- handoff
def handoff(ctx, a):
    ok = set(AGENTS) | {"owner"}
    if a.frm not in ok or a.to not in ok:
        die("from/to must be one of %s" % sorted(ok))
    entry = {"at": now(), "from": a.frm, "to": a.to, "task": a.task, "type": a.type, "summary": a.summary}
    path = ctx.p("state", "handoffs.jsonl")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    print("handoff recorded")


# ---------------------------------------------------------- features/gates
def feature_cmd(ctx, a):
    wf = ctx.workflow()
    feats = wf.setdefault("features", {})
    if a.action == "new":
        if a.name in feats:
            die("feature exists")
        feats[a.name] = {"title": a.title or a.name, "branch": a.branch, "pr": None, "head_sha": None,
                         "phase": "INTAKE", "gates": {}}
    else:
        f = feats.get(a.name) or die("unknown feature")
        for k in ("pr", "head_sha", "phase", "branch"):
            v = getattr(a, k)
            if v is not None:
                f[k] = v
    wf["updated"] = now()
    ctx.save(ctx.p("state", "workflow.json"), wf)
    print("ok")


def gate_set(ctx, a):
    if a.gate not in GATES:
        die("gate must be one of %s" % GATES)
    wf = ctx.workflow()
    f = wf["features"].get(a.feature) or die("unknown feature")
    f["gates"][a.gate] = {"pass": a.result == "pass", "sha": a.sha, "evidence": a.evidence, "at": now()}
    ctx.save(ctx.p("state", "workflow.json"), wf)
    print("gate %s=%s @%s" % (a.gate, a.result, a.sha))


def compute_gates(ctx, name):
    wf = ctx.workflow()
    f = wf["features"].get(name) or die("unknown feature")
    problems, head = [], f.get("head_sha")
    if not head:
        problems.append("head_sha not recorded")
    if not f.get("pr"):
        problems.append("no PR recorded")
    for g in GATES:
        rec = f["gates"].get(g)
        if g == "tester_no_blocking_bugs":
            bad = [b["id"] for b in ctx.records("bug")
                   if b["severity"] in ("BLOCKER", "HIGH", "MEDIUM") and b["status"] not in CLOSED_RECORD]
            if bad:
                problems.append("open bugs: %s" % bad)
                continue
        if g == "reviewer_no_actionable_findings":
            bad = [x["id"] for x in ctx.records("finding")
                   if str(x["pr"]) == str(f.get("pr")) and x["status"] not in CLOSED_RECORD]
            if bad:
                problems.append("unresolved findings: %s" % bad)
                continue
        if not rec:
            problems.append("gate %s not recorded" % g)
        elif not rec["pass"]:
            problems.append("gate %s FAILED" % g)
        elif head and rec["sha"] != head:
            problems.append("gate %s validated %s, not current head %s (stale)" % (g, rec["sha"], head))
        elif not rec.get("evidence"):
            problems.append("gate %s has no evidence" % g)
    return f, problems


def gates_cmd(ctx, a):
    f, problems = compute_gates(ctx, a.feature)
    if problems:
        print("NOT_READY")
        for p in problems:
            print(" - " + p)
        sys.exit(1)
    print("READY_FOR_OWNER_APPROVAL (head %s, PR %s) - merge still requires explicit owner action" %
          (f["head_sha"], f["pr"]))


# ------------------------------------------------------------ traceability
def trace_cmd(ctx, a):
    defined = {}
    for f in glob.glob(ctx.p("requirements", "**", "*.md"), recursive=True):
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^#{2,4}\s+(REQ-\d+)\b", line)
                if m:
                    defined[m.group(1)] = os.path.relpath(f, ctx.root)
    tasked = {r for t in ctx.tasks() for r in t.get("requirements", [])}
    tested = set()
    for f in glob.glob(ctx.p("testing", "**", "*"), recursive=True):
        if os.path.isfile(f):
            with open(f, encoding="utf-8", errors="ignore") as fh:
                tested |= set(re.findall(r"REQ-\d+", fh.read()))
    gaps = 0
    for r in sorted(defined):
        row = (r in tasked, r in tested)
        print("%-9s task=%-5s test=%-5s %s" % (r, row[0], row[1], defined[r]))
        gaps += (not row[0]) + (not row[1])
    unknown = sorted(tasked - set(defined))
    if unknown:
        print("tasks reference undefined requirements: %s" % unknown)
        gaps += len(unknown)
    print("traceability gaps: %d" % gaps)
    if gaps and a.strict:
        sys.exit(1)


# ----------------------------------------------------------- agent status
def agent_status(ctx, a):
    if a.agent not in AGENTS:
        die("unknown agent")
    path = ctx.p("state", "agent-status.json")
    d = ctx.load(path)
    d["agents"][a.agent] = {"state": a.state, "task": a.task, "updated": now()}
    ctx.save(path, d)
    print("ok")


# ------------------------------------------------------------- run-checks
def run_checks(ctx, a):
    cfg = ctx.load(ctx.p("config.json"))
    _, sha, _ = sh(["git", "rev-parse", "HEAD"], ctx.root)
    results, failed = {}, False
    for name, spec in cfg["checks"].items():
        cmd = spec.get("command")
        if not cmd:
            results[name] = {"status": "NOT_CONFIGURED", "required": spec.get("required", True)}
            if spec.get("required", True):
                failed = True
            continue
        r = subprocess.run(cmd, shell=True, cwd=ctx.root, capture_output=True, text=True)
        ok = r.returncode == 0
        results[name] = {"status": "PASS" if ok else "FAIL", "exit": r.returncode,
                         "tail": (r.stdout + r.stderr)[-1500:]}
        failed |= not ok
    out = {"sha": sha, "at": now(), "results": results}
    ctx.save(ctx.p("testing", "test-results", "checks-%s.json" % (sha[:12] or "nosha")), out)
    for k, v in results.items():
        print("%-12s %s" % (k, v["status"]))
    if failed:
        print("REQUIRED CHECKS NOT PASSING (NOT_CONFIGURED counts as not passing)")
        sys.exit(1)


# ------------------------------------------------------------------ resume
def resume(ctx, a):
    L = []
    wf = ctx.workflow()
    L.append("== AI TEAM RESUME (%s) ==" % ("brief" if a.brief else "full"))
    L.append("Project: %s | state updated: %s" % (wf.get("project", "?"), wf.get("updated")))
    rc, branch, _ = sh(["git", "symbolic-ref", "--short", "-q", "HEAD"], ctx.root)
    _, dirty, _ = sh(["git", "status", "--porcelain"], ctx.root)
    _, sha, _ = sh(["git", "rev-parse", "HEAD"], ctx.root)
    L.append("Git: branch=%s head=%s dirty_files=%d" % (branch if rc == 0 else "n/a", sha[:10] or "none", len(dirty.splitlines())))
    if branch in ("main", "master"):
        L.append("WARNING: on protected branch %s - create an ai/<slug> branch before any edit" % branch)
    _, branches, _ = sh(["git", "branch", "--format=%(refname:short)"], ctx.root)
    L.append("Local branches: %s" % (", ".join(branches.split()) or "none"))
    for name, f in wf.get("features", {}).items():
        line = "Feature %s: phase=%s branch=%s PR=%s recorded_head=%s" % (name, f["phase"], f["branch"], f["pr"], (f["head_sha"] or "-")[:10])
        _, tip, _ = sh(["git", "rev-parse", "--verify", "-q", f["branch"] or "-"], ctx.root)
        if f["branch"] and not tip:
            line += "  [RECONCILE: branch not found locally - fetch or recreate]"
        elif tip and f["head_sha"] and tip != f["head_sha"]:
            line += "  [RECONCILE: branch tip %s != recorded head - gates are STALE, rerun tests/review]" % tip[:10]
        L.append(line)
    if not a.brief:
        if sh(["gh", "auth", "status"], ctx.root)[0] == 0:
            rc, prs, err = sh(["gh", "pr", "list", "--json", "number,headRefName,baseRefName,headRefOid,state"], ctx.root)
            L.append("Open PRs (gh): %s" % (prs if rc == 0 else "unavailable: " + err[:120]))
        else:
            L.append("Open PRs: gh not authenticated - use GitHub MCP tools (mcp__github__list_pull_requests) to reconcile")
    open_t = [t for t in ctx.tasks() if t["status"] not in ("DONE", "CANCELLED")]
    L.append("Incomplete tasks: %d" % len(open_t))
    for t in open_t:
        L.append("  %s %s [%s] %s%s" % (t["id"], t["status"], t["assigned_agent"], t["title"],
                                         " blocked_by=" + ",".join(t["blocked_by"]) if t["blocked_by"] else ""))
    oq = [c for c in ctx.clarifications() if c["status"] != "ANSWERED"]
    L.append("Unresolved clarifications: %d" % len(oq))
    for c in oq:
        L.append("  %s %s route=%s: %s" % (c["id"], c["status"], c["route"], c["question"]))
    ob = [b for b in ctx.records("bug") if b["status"] not in CLOSED_RECORD]
    of = [x for x in ctx.records("finding") if x["status"] not in CLOSED_RECORD]
    L.append("Open bugs: %s" % ([b["id"] + ":" + b["severity"] for b in ob] or "none"))
    L.append("Open findings: %s" % ([x["id"] + ":" + x["severity"] for x in of] or "none"))
    L.append("Next: reconcile any [RECONCILE] items, then resume the earliest unblocked incomplete task. Persisted state never overrides Git/GitHub evidence.")
    print("\n".join(L))


# ----------------------------------------------------------- validate-state
def validate_state(ctx, a):
    errs = []
    wf = ctx.load(ctx.p("state", "workflow.json"))
    for k in ("version", "project", "features"):
        if k not in wf:
            errs.append("workflow.json missing " + k)
    st = ctx.load(ctx.p("state", "agent-status.json"))
    if sorted(st.get("agents", {})) != sorted(AGENTS):
        errs.append("agent-status.json must list exactly the 7 agents")
    ids = set()
    for t in ctx.tasks():
        miss = [k for k in TASK_REQUIRED if k not in t]
        if miss:
            errs.append("%s missing %s" % (t.get("id"), miss))
            continue
        ids.add(t["id"])
        if t["status"] not in STATUSES:
            errs.append("%s bad status" % t["id"])
        if t["assigned_agent"] not in AGENTS:
            errs.append("%s bad agent" % t["id"])
        if t["status"] == "DONE" and not t["evidence"]:
            errs.append("%s is DONE without evidence" % t["id"])
        if t["status"] == "BLOCKED" and not t["blocked_by"]:
            errs.append("%s BLOCKED without clarification" % t["id"])
    for t in ctx.tasks():
        for d in t.get("dependencies", []):
            if d not in ids:
                errs.append("%s depends on unknown %s" % (t["id"], d))
    for kind, spec in RECORD_KINDS.items():
        for r in ctx.records(kind):
            miss = [k for k in spec["required"] if not r.get(k)]
            if miss:
                errs.append("%s missing %s" % (r.get("id"), miss))
    for name, f in wf.get("features", {}).items():
        for g in f.get("gates", {}):
            if g not in GATES:
                errs.append("feature %s has unknown gate %s" % (name, g))
    if errs:
        print("\n".join("INVALID: " + e for e in errs))
        sys.exit(1)
    print("state valid (%d tasks)" % len(ids))


def build_parser():
    p = argparse.ArgumentParser(prog="ai_team.py")
    p.add_argument("--root")
    sub = p.add_subparsers(dest="cmd", required=True)

    t = sub.add_parser("task").add_subparsers(dest="sub", required=True)
    n = t.add_parser("new"); n.set_defaults(fn=task_new)
    n.add_argument("id"); n.add_argument("title"); n.add_argument("--owner", required=True)
    n.add_argument("--description"); n.add_argument("--scope")
    n.add_argument("--deps", action="append"); n.add_argument("--ac", action="append")
    n.add_argument("--inputs", action="append"); n.add_argument("--outputs", action="append")
    n.add_argument("--req", action="append")
    m = t.add_parser("move"); m.set_defaults(fn=task_move)
    m.add_argument("id"); m.add_argument("status"); m.add_argument("--evidence")
    m.add_argument("--by"); m.add_argument("--pr"); m.add_argument("--note")
    m.add_argument("--blocked-by", action="append")
    l = t.add_parser("list"); l.set_defaults(fn=task_list); l.add_argument("--status")

    c = sub.add_parser("clarify").add_subparsers(dest="sub", required=True)
    cn = c.add_parser("new"); cn.set_defaults(fn=clarify_new)
    cn.add_argument("question"); cn.add_argument("--asked-by", required=True)
    cn.add_argument("--route", required=True); cn.add_argument("--blocks", action="append")
    ca = c.add_parser("answer"); ca.set_defaults(fn=clarify_answer)
    ca.add_argument("id"); ca.add_argument("--classification", required=True)
    ca.add_argument("--answer", required=True); ca.add_argument("--source")
    cl = c.add_parser("list"); cl.set_defaults(fn=clarify_list); cl.add_argument("--all", action="store_true")

    r = sub.add_parser("record").add_subparsers(dest="sub", required=True)
    rn = r.add_parser("new"); rn.set_defaults(fn=record_new)
    rn.add_argument("kind", choices=list(RECORD_KINDS)); rn.add_argument("--json", required=True)
    ru = r.add_parser("update"); ru.set_defaults(fn=record_update)
    ru.add_argument("id"); ru.add_argument("--status", required=True); ru.add_argument("--sha")
    ru.add_argument("--verifier"); ru.add_argument("--evidence"); ru.add_argument("--disposition")

    h = sub.add_parser("handoff"); h.set_defaults(fn=handoff)
    h.add_argument("--from", dest="frm", required=True); h.add_argument("--to", required=True)
    h.add_argument("--task"); h.add_argument("--type", required=True); h.add_argument("--summary", required=True)

    f = sub.add_parser("feature"); f.set_defaults(fn=feature_cmd)
    f.add_argument("action", choices=["new", "set"]); f.add_argument("name")
    f.add_argument("--title"); f.add_argument("--branch"); f.add_argument("--pr")
    f.add_argument("--head-sha"); f.add_argument("--phase")

    g = sub.add_parser("gate"); g.set_defaults(fn=gate_set)
    g.add_argument("feature"); g.add_argument("gate"); g.add_argument("result", choices=["pass", "fail"])
    g.add_argument("--sha", required=True); g.add_argument("--evidence")
    gs = sub.add_parser("gates"); gs.set_defaults(fn=gates_cmd); gs.add_argument("feature")

    tr = sub.add_parser("trace"); tr.set_defaults(fn=trace_cmd); tr.add_argument("--strict", action="store_true")
    rs = sub.add_parser("resume"); rs.set_defaults(fn=resume); rs.add_argument("--brief", action="store_true")
    sub.add_parser("validate-state").set_defaults(fn=validate_state)
    sub.add_parser("run-checks").set_defaults(fn=run_checks)
    ag = sub.add_parser("agent-status"); ag.set_defaults(fn=agent_status)
    ag.add_argument("agent"); ag.add_argument("state", choices=["idle", "working", "blocked"]); ag.add_argument("--task")
    return p


def main():
    a = build_parser().parse_args()
    ctx = Ctx(find_root(a.root))
    a.fn(ctx, a)


if __name__ == "__main__":
    main()
