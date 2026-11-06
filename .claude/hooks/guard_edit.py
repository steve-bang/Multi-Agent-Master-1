#!/usr/bin/env python3
"""PreToolUse(Write|Edit|MultiEdit) safety hook. Exit 2 = block.

1. Never edit on main/master.
2. Never write secret-bearing files or obvious secrets into content.
3. Best-effort role fences when the harness reports the calling subagent
   (`agent_type`): reviewer may write only under .ai-team/reviews/, tester only
   under .ai-team/testing/ and test directories/files, client writes nothing.
   Primary role enforcement is each agent's `tools:` frontmatter; this is defence in depth.
"""
import fnmatch, json, os, re, subprocess, sys

SECRET_PATH = [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*", "*credentials*.json"]
SECRET_CONTENT = [r"AKIA[0-9A-Z]{16}", r"gh[pousr]_[A-Za-z0-9]{30,}", r"sk-[A-Za-z0-9_-]{30,}",
                  r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----", r"xox[baprs]-[A-Za-z0-9-]{10,}"]
TEST_PATH = [r"(^|/)(tests?|__tests__|e2e|spec|cypress|playwright)/", r"\.(test|spec)\.[A-Za-z]+$", r"(^|/)test_[^/]+\.py$"]


def branch(cwd):
    try:
        return subprocess.run(["git", "symbolic-ref", "--short", "-q", "HEAD"], cwd=cwd,
                              capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return 0
    ti = d.get("tool_input") or {}
    path = ti.get("file_path") or ""
    cwd = d.get("cwd") or "."
    rel = os.path.relpath(os.path.abspath(path), os.path.abspath(cwd)) if path else ""
    errs = []
    if branch(cwd) in ("main", "master"):
        errs.append("editing on main/master is forbidden; create an ai/<slug> branch first")
    base = os.path.basename(path)
    if any(fnmatch.fnmatch(base, g) for g in SECRET_PATH) and not base.endswith((".example", ".sample")):
        errs.append("writing secret-bearing files is not allowed (use .env.example with placeholders)")
    content = " ".join(str(ti.get(k, "")) for k in ("content", "new_string")) + json.dumps(ti.get("edits", ""))
    if any(re.search(p, content) for p in SECRET_CONTENT):
        errs.append("content looks like a credential/secret; never commit secrets")
    role = d.get("agent_type") or ""
    if role == "reviewer" and not rel.startswith(".ai-team/reviews/"):
        errs.append("reviewer may only write under .ai-team/reviews/ and never fixes code")
    if role == "tester" and not (rel.startswith(".ai-team/testing/") or any(re.search(p, rel) for p in TEST_PATH)):
        errs.append("tester may only write test artifacts (.ai-team/testing/, test files), never production code")
    if role == "client":
        errs.append("client agent is read-only")
    if errs:
        print("BLOCKED by AI-team safety hook: " + "; ".join(errs), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
