#!/usr/bin/env python3
"""PreToolUse(Bash) safety hook. Exit 2 = block (stderr is shown to Claude).

Deterministic guardrails only; orchestration lives in the Orchestrator, not here.
Blocks: pushes to main/master, force pushes, merges, PR approval/merge via gh,
--no-verify, destructive deletes/resets, and obvious secret exfiltration.
"""
import json, re, subprocess, sys

PROTECTED = r"(main|master)"


def current_branch(cwd):
    try:
        return subprocess.run(["git", "symbolic-ref", "--short", "-q", "HEAD"], cwd=cwd,
                              capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""


def reasons(cmd, cwd):
    out = []
    for seg in re.split(r"&&|\|\||;|\n|\|", cmd):
        s = seg.strip()
        if re.match(r"^(\S+=\S+\s+)*git\s+(-\S+\s+)*push\b", s):
            if re.search(r"(--force\b|--force-with-lease|\s-f\b|--delete\b|\s\+\S)", s):
                out.append("force/delete push is not allowed")
            if re.search(r"(^|[\s:/+])%s(\s|$)" % PROTECTED, s.split("push", 1)[1]):
                out.append("pushing to main/master is forbidden; push a feature branch and open a PR")
            elif not re.search(r"\borigin\s+\S+", s) and current_branch(cwd) in ("main", "master"):
                out.append("bare `git push` while on main/master is forbidden")
            elif re.search(r"\bHEAD\b", s) and current_branch(cwd) in ("main", "master"):
                out.append("pushing HEAD from main/master is forbidden")
        if re.match(r"^git\s+(-\S+\s+)*(merge|rebase)\b", s) and current_branch(cwd) in ("main", "master"):
            out.append("merge/rebase on main/master is forbidden (the Project Owner merges PRs)")
        if re.match(r"^git\s+(-\S+\s+)*(commit|cherry-pick|revert|am)\b", s) and current_branch(cwd) in ("main", "master"):
            out.append("committing on main/master is forbidden; create an ai/<slug> branch")
        if re.match(r"^gh\s+pr\s+(merge|review\b.*--approve)", s):
            out.append("merging/approving PRs via gh is reserved for the Project Owner")
        if re.match(r"^gh\s+api\b.*(merge|reviews)", s) and re.search(r"(-X|--method)\s+(PUT|POST)", s):
            out.append("merge/review via gh api is reserved for the Project Owner")
        if "--no-verify" in s or "--no-gpg-sign" in s:
            out.append("hook/signature bypass flags are not allowed")
        if re.match(r"^git\s+(-\S+\s+)*reset\s+--hard\b", s) and re.search(r"origin|main|master", s):
            out.append("destructive reset against remote/main is not allowed")
        if re.match(r"^git\s+(-\S+\s+)*(clean\s+-\S*f|branch\s+-D\s+(main|master))", s):
            out.append("destructive git cleanup is not allowed")
        if re.match(r"^rm\s+(-\S+\s+)*(/|~|\$HOME|\.git\b|\.\.?/?)(\s|$)", s) and re.search(r"-\S*r", s):
            out.append("destructive rm is not allowed")
        if re.search(r"(DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE)", s, re.I):
            out.append("destructive SQL needs Project Owner approval")
        if re.search(r"\b(deploy|publish)\b.*\b(prod|production)\b", s, re.I) or re.match(r"^(npm|yarn|pnpm)\s+publish", s):
            out.append("production deploy/publish is never automatic")
        if re.search(r"(cat|less|more|head|tail|cp|curl.*-d\s*@)\s+\S*(\.env\b|\.pem\b|id_rsa|\.aws/credentials)", s):
            out.append("reading/exporting secret files is not allowed")
    return sorted(set(out))


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (data.get("tool_input") or {}).get("command", "")
    cwd = data.get("cwd") or "."
    rs = reasons(cmd, cwd)
    if rs:
        print("BLOCKED by AI-team safety hook: " + "; ".join(rs) +
              ". If this is truly required, escalate to the Project Owner via the Orchestrator.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
