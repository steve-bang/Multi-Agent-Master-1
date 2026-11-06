#!/usr/bin/env python3
"""Validate the AI-team configuration (agents, skills, commands, rules, hooks, permissions, state, secrets).
Exit 0 only if every check passes. Stdlib only."""
import glob, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AGENTS = {"orchestrator", "ba", "designer", "senior-fullstack-dev", "tester", "reviewer", "client"}
SKILLS = {"project-orchestration", "requirement-analysis", "ui-ux-design", "fullstack-development",
          "software-testing", "pull-request-review", "client-clarification"}
COMMANDS = {"start-project", "new-feature", "resume", "status", "review-pr"}
RULES = {"communication", "git-workflow", "task-management", "quality-gates", "security"}
SECTIONS = ["Role", "Responsibilities", "Allowed tools", "Restricted actions", "Input contract",
            "Output contract", "Communication protocol", "Completion criteria"]
DENY_MUST = ["Bash(git push --force*)", "Bash(git push origin main*)", "Bash(gh pr merge*)", "Read(./.env)"]
SECRET_RE = [r"AKIA[0-9A-Z]{16}", r"gh[pousr]_[A-Za-z0-9]{30,}", r"sk-[A-Za-z0-9_-]{30,}",
             r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----"]
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))


def frontmatter(path):
    t = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", t, re.S)
    if not m:
        return None, t
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip()
    return fm, m.group(2)


def P(*a):
    return os.path.join(ROOT, *a)


# agents
files = {os.path.basename(f)[:-3] for f in glob.glob(P(".claude", "agents", "*.md"))}
check("exactly seven agents", files == AGENTS, "found %s" % sorted(files))
for a in sorted(AGENTS & files):
    fm, body = frontmatter(P(".claude", "agents", a + ".md"))
    ok = bool(fm) and fm.get("name") == a and len(fm.get("description", "")) > 20 and "tools" in fm
    check("agent %s frontmatter" % a, ok, str(fm and list(fm)))
    missing = [s for s in SECTIONS if not re.search(r"^# %s\b" % re.escape(s), body, re.M)]
    check("agent %s sections" % a, not missing, "missing %s" % missing)
orch, _ = frontmatter(P(".claude", "agents", "orchestrator.md")) if "orchestrator" in files else (None, "")
check("orchestrator can delegate (Agent tool)", bool(orch) and "Agent(" in orch.get("tools", ""))
if orch:
    allowed = set(re.findall(r"Agent\(([^)]*)\)", orch["tools"])[0].replace(" ", "").split(","))
    check("orchestrator delegates to exactly the six specialists", allowed == AGENTS - {"orchestrator"}, str(allowed))
for a in ("reviewer", "client"):
    fm, _ = frontmatter(P(".claude", "agents", a + ".md"))
    check("%s has no Edit tool" % a, "Edit" not in fm["tools"])
fm, _ = frontmatter(P(".claude", "agents", "client.md"))
check("client is read-only", not re.search(r"Write|Bash|Edit", fm["tools"]))

# skills
sk = {os.path.basename(os.path.dirname(f)) for f in glob.glob(P(".claude", "skills", "*", "SKILL.md"))}
check("seven skills present", sk == SKILLS, "found %s" % sorted(sk))
for s in sorted(SKILLS & sk):
    fm, body = frontmatter(P(".claude", "skills", s, "SKILL.md"))
    check("skill %s frontmatter + procedure" % s,
          bool(fm) and fm.get("name") == s and len(fm.get("description", "")) > 30
          and len(re.findall(r"^\s*(\d+\.|##)", body, re.M)) >= 5)

# commands
cm = {os.path.basename(f)[:-3] for f in glob.glob(P(".claude", "commands", "*.md"))}
check("five commands present", cm == COMMANDS, "found %s" % sorted(cm))
for c in sorted(COMMANDS & cm):
    fm, body = frontmatter(P(".claude", "commands", c + ".md"))
    check("command %s has description + body" % c, bool(fm) and "description" in fm and len(body) > 80)

# rules
rl = {os.path.basename(f)[:-3] for f in glob.glob(P(".claude", "rules", "*.md"))}
check("five rule files present", rl == RULES, "found %s" % sorted(rl))

# settings, hooks, permissions
try:
    st = json.load(open(P(".claude", "settings.json")))
    check("settings.json parses", True)
except Exception as e:
    st = {}
    check("settings.json parses", False, str(e))
check("main session runs as orchestrator", st.get("agent") == "orchestrator")
deny = st.get("permissions", {}).get("deny", [])
check("critical deny rules present", all(d in deny for d in DENY_MUST), str([d for d in DENY_MUST if d not in deny]))
allow = st.get("permissions", {}).get("allow", [])
check("no broad Bash allow", not any(x in ("Bash", "Bash(*)") for x in allow))
hook_cmds = [h["command"] for ev in st.get("hooks", {}).values() for g in ev for h in g["hooks"]]
check("hooks configured (SessionStart + PreToolUse)", {"SessionStart", "PreToolUse"} <= set(st.get("hooks", {})))
for c in hook_cmds:
    m = re.search(r'\$CLAUDE_PROJECT_DIR/([^"\s]+)', c)
    check("hook script exists: %s" % (m and m.group(1)), bool(m) and os.path.exists(P(m.group(1))))
for h in glob.glob(P(".claude", "hooks", "*.py")):
    r = subprocess.run([sys.executable, "-m", "py_compile", h], capture_output=True)
    check("hook compiles: %s" % os.path.basename(h), r.returncode == 0)

# state
r = subprocess.run([sys.executable, P(".ai-team", "scripts", "ai_team.py"), "--root", ROOT, "validate-state"],
                   capture_output=True, text=True)
check("workflow state schema", r.returncode == 0, r.stdout + r.stderr)
cfg = json.load(open(P(".ai-team", "config.json")))
check("config.json checks block + main default", "checks" in cfg and cfg["default_branch"] == "main"
      and cfg["auto_merge"] is False and cfg["auto_deploy"] is False)
for need in ("PROJECT.md",):
    check(".ai-team/%s exists" % need, os.path.exists(P(".ai-team", need)))
check("PR template exists", os.path.exists(P(".github", "pull_request_template.md")))

# secrets scan over tracked-ish files
hits = []
for dirpath, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in (".git", "node_modules", "__pycache__")]
    for f in fn:
        p = os.path.join(dirpath, f)
        if os.path.basename(p) in ("guard_edit.py", "validate_config.py", "test_hooks.py"):
            continue  # contain detection patterns / fake fixtures
        try:
            t = open(p, encoding="utf-8").read()
        except Exception:
            continue
        if any(re.search(x, t) for x in SECRET_RE):
            hits.append(os.path.relpath(p, ROOT))
check("no secrets in files", not hits, str(hits))

bad = [(n, d) for n, ok, d in results if not ok]
for n, ok, d in results:
    print("%s %s%s" % ("PASS" if ok else "FAIL", n, "" if ok or not d else "  -> " + d))
print("\n%d checks, %d failed" % (len(results), len(bad)))
sys.exit(1 if bad else 0)
