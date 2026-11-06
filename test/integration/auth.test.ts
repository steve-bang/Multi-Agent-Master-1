import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { buildApp } from '../../src/server/app.js';

const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
const setup = () => {
  const db = openDb(':memory:');
  return { db, app: buildApp(db) };
};
const post = (app: ReturnType<typeof buildApp>, url: string, payload: unknown, headers: Record<string, string> = H) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers });
const sid = (res: { headers: Record<string, unknown> }) => String(res.headers['set-cookie']).split(';')[0];

describe('REQ-003 auth', () => {
  it('REQ-003 đăng ký ok, email không phân biệt hoa thường, đăng nhập được', async () => {
    const { app } = setup();
    const r = await post(app, '/api/auth/register', { email: ' A@B.vn ', password: 'matkhau123' });
    expect(r.statusCode).toBe(201);
    expect(r.json().user.email).toBe('a@b.vn');
    const l = await post(app, '/api/auth/login', { email: 'A@b.VN', password: 'matkhau123' });
    expect(l.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { ...H, cookie: sid(l) } });
    expect(me.statusCode).toBe(200);
  });

  it('REQ-003 email trùng trả 409 thân thiện', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    const r = await post(app, '/api/auth/register', { email: 'A@B.vn', password: 'khac12345' });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('EMAIL_EXISTS');
    expect(db.prepare('SELECT COUNT(*) c FROM users').get()).toEqual({ c: 1 });
  });

  it('REQ-003 mật khẩu ngắn và email sai định dạng bị từ chối', async () => {
    const { app } = setup();
    const r = await post(app, '/api/auth/register', { email: 'a@b.vn', password: '1234567' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('PASSWORD_WEAK');
    const e = await post(app, '/api/auth/register', { email: 'khong-hop-le', password: 'matkhau123' });
    expect(e.json().error.code).toBe('EMAIL_INVALID');
  });

  it('REQ-003 đăng nhập sai báo chung chung, không lộ email tồn tại', async () => {
    const { app } = setup();
    await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    const wrong = await post(app, '/api/auth/login', { email: 'a@b.vn', password: 'saisaisai' });
    const none = await post(app, '/api/auth/login', { email: 'x@b.vn', password: 'saisaisai' });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual(none.json());
    expect(wrong.json().error.message).toBe('Email hoặc mật khẩu không đúng.');
  });

  it('REQ-003 khóa sau 5 lần sai, kể cả khi sau đó nhập đúng', async () => {
    const { app } = setup();
    await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    for (let i = 0; i < 5; i++) {
      expect((await post(app, '/api/auth/login', { email: 'a@b.vn', password: 'sai-sai-sai' })).statusCode).toBe(401);
    }
    const locked = await post(app, '/api/auth/login', { email: 'a@b.vn', password: 'matkhau123' });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('RATE_LIMITED');
  });

  it('REQ-003 đăng xuất hủy phiên', async () => {
    const { app, db } = setup();
    const r = await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    const cookie = sid(r);
    const out = await post(app, '/api/auth/logout', undefined, { ...H, cookie });
    expect(out.statusCode).toBe(204);
    expect(db.prepare('SELECT COUNT(*) c FROM sessions').get()).toEqual({ c: 0 });
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { ...H, cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('REQ-003 cookie phiên có HttpOnly và SameSite=Lax; token lưu dạng băm', async () => {
    const { app, db } = setup();
    const r = await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    const c = String(r.headers['set-cookie']);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    const token = sid(r).split('=')[1];
    const row = db.prepare('SELECT id_hash FROM sessions').get() as { id_hash: string };
    expect(row.id_hash).not.toBe(token);
  });

  it('REQ-003 CSRF: Origin sai hoặc thiếu bị từ chối 403', async () => {
    const { app, db } = setup();
    const body = { email: 'a@b.vn', password: 'matkhau123' };
    const bad = await post(app, '/api/auth/register', body, { host: 'localhost:3000', origin: 'http://evil.example' });
    expect(bad.statusCode).toBe(403);
    const none = await post(app, '/api/auth/register', body, { host: 'localhost:3000' });
    expect(none.statusCode).toBe(403);
    expect(db.prepare('SELECT COUNT(*) c FROM users').get()).toEqual({ c: 0 });
  });

  it('REQ-003 mật khẩu không nằm dạng rõ trong DB (scrypt có salt)', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', { email: 'a@b.vn', password: 'matkhau123' });
    await post(app, '/api/auth/register', { email: 'c@b.vn', password: 'matkhau123' });
    const rows = db.prepare('SELECT password_hash h FROM users').all() as { h: string }[];
    expect(rows[0].h.startsWith('scrypt$')).toBe(true);
    expect(rows[0].h).not.toContain('matkhau123');
    expect(rows[0].h).not.toBe(rows[1].h);
  });

  it('REQ-003 trang /dang-ky và /dang-nhap render tiếng Việt', async () => {
    const { app } = setup();
    const a = await app.inject({ method: 'GET', url: '/dang-ky' });
    const b = await app.inject({ method: 'GET', url: '/dang-nhap' });
    expect(a.body).toContain('<html lang="vi">');
    expect(a.body).toContain('new-password');
    expect(b.body).toContain('current-password');
    expect(b.body).toContain('Đăng nhập');
  });
});
