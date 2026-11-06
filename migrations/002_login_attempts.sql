CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  at_ms INTEGER NOT NULL
);
CREATE INDEX idx_login_attempts_email_at ON login_attempts (email, at_ms);
