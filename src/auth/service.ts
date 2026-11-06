import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/index.js';
import { hashPassword, verifyPassword } from './password.js';

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 256;
export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUser = { id: number; email: string };

export const normEmail = (e: string): string => e.trim().toLowerCase();
export const isEmail = (e: string): boolean => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export function createSession(db: Db, userId: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    new Date(Date.now() + SESSION_MS).toISOString(),
  );
  return token;
}

export function destroySession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
}

export function userFromSession(db: Db, token: string | undefined): AuthUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      'SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?',
    )
    .get(sha256(token)) as { id: number; email: string; expires_at: string } | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    destroySession(db, token);
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function register(
  db: Db,
  email: string,
  password: string,
): Promise<{ user: AuthUser } | { error: 'EMAIL_EXISTS' }> {
  const hash = await hashPassword(password);
  try {
    const r = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    return { user: { id: Number(r.lastInsertRowid), email } };
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return { error: 'EMAIL_EXISTS' };
    throw e;
  }
}

// Hash giả để thời gian phản hồi không lộ email có tồn tại hay không.
const dummyHash = hashPassword('dummy-password-for-timing');

export function isLocked(db: Db, email: string): boolean {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE email = ? AND at_ms > ?')
    .get(email, Date.now() - WINDOW_MS) as { c: number };
  return row.c >= MAX_FAILS;
}

export async function login(
  db: Db,
  email: string,
  password: string,
): Promise<{ user: AuthUser } | { error: 'BAD_CREDENTIALS' | 'RATE_LIMITED' }> {
  if (isLocked(db, email)) return { error: 'RATE_LIMITED' };
  const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; email: string; password_hash: string }
    | undefined;
  const ok = await verifyPassword(password, row ? row.password_hash : await dummyHash);
  if (!row || !ok) {
    db.prepare('INSERT INTO login_attempts (email, at_ms) VALUES (?, ?)').run(email, Date.now());
    return { error: 'BAD_CREDENTIALS' };
  }
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
  return { user: { id: row.id, email: row.email } };
}
