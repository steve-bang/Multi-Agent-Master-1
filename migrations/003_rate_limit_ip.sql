ALTER TABLE login_attempts ADD COLUMN ip TEXT NOT NULL DEFAULT '';
ALTER TABLE login_attempts ADD COLUMN kind TEXT NOT NULL DEFAULT 'login';
CREATE INDEX idx_login_attempts_kind_ip_at ON login_attempts (kind, ip, at_ms);
