"""Tests for the safety hooks (guard_bash.py, guard_edit.py)."""
import json, os, subprocess, sys, tempfile, unittest

SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASH = os.path.join(SRC, ".claude", "hooks", "guard_bash.py")
EDIT = os.path.join(SRC, ".claude", "hooks", "guard_edit.py")
FAKE_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"  # assembled at runtime so no secret-looking literal is committed


def run(hook, payload):
    r = subprocess.run([sys.executable, hook], input=json.dumps(payload), capture_output=True, text=True)
    return r.returncode


class TestHooks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.feat = tempfile.mkdtemp(); cls.main = tempfile.mkdtemp()
        subprocess.run(["git", "init", "-q", "-b", "ai/x"], cwd=cls.feat)
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=cls.main)

    def b(self, cmd, cwd=None):
        return run(BASH, {"tool_input": {"command": cmd}, "cwd": cwd or self.feat})

    def test_blocks(self):
        for c in ["git push origin main", "git push -u origin HEAD:main", "git push --force origin ai/x",
                  "git push -f", "git push origin +ai/x", "gh pr merge 5 --squash", "gh pr review 5 --approve",
                  "git commit --no-verify -m x", "git reset --hard origin/main", "rm -rf /",
                  "echo hi && git push origin master", "cat .env", "npm publish"]:
            self.assertEqual(self.b(c), 2, c)

    def test_blocks_on_main_branch(self):
        for c in ["git commit -m x", "git merge ai/x", "git push"]:
            self.assertEqual(self.b(c, self.main), 2, c)

    def test_allows(self):
        for c in ["git push -u origin ai/feature", "git status", "git commit -m 'T-1: x'", "git diff origin/main...HEAD",
                  "python3 .ai-team/scripts/ai_team.py resume", "gh pr create --base main --title x", "ls -la"]:
            self.assertEqual(self.b(c), 0, c)

    def e(self, path, cwd=None, agent=None, content="x"):
        d = {"tool_input": {"file_path": path, "content": content}, "cwd": cwd or self.feat}
        if agent:
            d["agent_type"] = agent
        return run(EDIT, d)

    def test_edit_rules(self):
        self.assertEqual(self.e(os.path.join(self.main, "a.py"), self.main), 2)  # on main
        self.assertEqual(self.e(os.path.join(self.feat, "a.py")), 0)
        self.assertEqual(self.e(os.path.join(self.feat, ".env")), 2)
        self.assertEqual(self.e(os.path.join(self.feat, ".env.example")), 0)
        self.assertEqual(self.e(os.path.join(self.feat, "a.txt"), content="k=" + FAKE_KEY), 2)
        self.assertEqual(self.e(os.path.join(self.feat, "src/app.py"), agent="reviewer"), 2)
        self.assertEqual(self.e(os.path.join(self.feat, ".ai-team/reviews/findings/x.json"), agent="reviewer"), 0)
        self.assertEqual(self.e(os.path.join(self.feat, "src/app.py"), agent="tester"), 2)
        self.assertEqual(self.e(os.path.join(self.feat, "tests/test_app.py"), agent="tester"), 0)
        self.assertEqual(self.e(os.path.join(self.feat, "x.md"), agent="client"), 2)


if __name__ == "__main__":
    unittest.main()
