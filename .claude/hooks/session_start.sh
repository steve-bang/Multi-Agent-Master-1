#!/usr/bin/env bash
# SessionStart hook: inject a brief resume summary so a restarted session recovers state.
# Read-only; never fails the session.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -f "$root/.ai-team/scripts/ai_team.py" ]; then
  python3 "$root/.ai-team/scripts/ai_team.py" --root "$root" resume --brief 2>&1 || true
  echo "Run /resume for the full reconciliation against Git/GitHub before continuing work."
fi
exit 0
