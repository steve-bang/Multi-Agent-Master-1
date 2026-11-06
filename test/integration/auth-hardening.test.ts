import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { MAX_CONCURRENT_SCRYPT, scryptStats } from '../../src/auth/password.js';
import { buildApp } from '../../src/server/app.js';

const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
type App = ReturnType<typeof buildApp>;
const setup = (opts?: { trustProxy?: boolean }) => {
  const db = openDb(':memory:');
  return { db, app: buildApp(db, opts) };
};
const post = (app: App, url: string, payload: unknown, remoteAddress?: string, headers: Record<string, string> = H) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers, remoteAddress });
const sid = (res: { headers: Record<string, unknown> }) => String(res.headers['set-cookie']).split(';')[0];
const GOOD = { email: 'a@b.vn', password: 'matkhau123' };
const BAD = { email: 'a@b.vn', password: 'sai-sai-sai' };
const count = (db: ReturnType<typeof openDb>, sql = 'SELECT COUNT(*) c FROM login_attempts') =>
  (db.prepare(sql).get() as { c: number }).c;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('FND-001 race khóa đăng nhập', () => {
  it('20 login sai song song: đúng 5 x 401, 15 x 429, 5 dòng login_attempts', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', GOOD);
    const rs = await Promise.all(Array.from({ length: 20 }, () => post(app, '/api/auth/login', BAD)));
    expect(rs.filter((r) => r.statusCode === 401)).toHaveLength(5);
    expect(rs.filter((r) => r.statusCode === 429)).toHaveLength(15);
    expect(count(db, "SELECT COUNT(*) c FROM login_attempts WHERE kind = 'login'")).toBe(5);
  });
});

describe('FND-002 guard /studio', () => {
  it('chưa đăng nhập -> 302 /dang-nhap; đã đăng nhập -> 200 tiếng Việt', async () => {
    const { app } = setup();
    const anon = await app.inject({ method: 'GET', url: '/studio' });
    expect(anon.statusCode).toBe(302);
    expect(anon.headers.location).toBe('/dang-nhap');
    const r = await post(app, '/api/auth/register', GOOD);
    const ok = await app.inject({ method: 'GET', url: '/studio', headers: { cookie: sid(r) } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain('Không gian làm việc');
  });

  it('phiên hết hạn -> 302 và phiên bị xóa', async () => {
    const { app, db } = setup();
    const r = await post(app, '/api/auth/register', GOOD);
    db.prepare('UPDATE sessions SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
    const res = await app.inject({ method: 'GET', url: '/studio', headers: { cookie: sid(r) } });
    expect(res.statusCode).toBe(302);
    expect(count(db, 'SELECT COUNT(*) c FROM sessions')).toBe(0);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: sid(r) } });
    expect(me.statusCode).toBe(401);
  });
});

describe('FND-003 guard Origin toàn app', () => {
  it('route POST của plugin khác cũng bị 403 khi Origin sai/thiếu, 200 khi đúng', async () => {
    const { app } = setup();
    await app.register(async (i) => {
      i.post('/fake', async () => ({ ok: true }));
    });
    const bad = await post(app, '/fake', {}, undefined, { host: 'localhost:3000', origin: 'http://evil.example' });
    const none = await post(app, '/fake', {}, undefined, { host: 'localhost:3000' });
    const good = await post(app, '/fake', {});
    expect([bad.statusCode, none.statusCode, good.statusCode]).toEqual([403, 403, 200]);
  });
});

describe('FND-004 khóa theo (IP, email), rate limit register, scrypt đồng thời', () => {
  it('5 lần sai từ IP A không khóa đăng nhập đúng từ IP B', async () => {
    const { app } = setup();
    await post(app, '/api/auth/register', GOOD, '10.0.0.9');
    for (let i = 0; i < 5; i++) expect((await post(app, '/api/auth/login', BAD, '10.0.0.1')).statusCode).toBe(401);
    expect((await post(app, '/api/auth/login', GOOD, '10.0.0.1')).statusCode).toBe(429);
    expect((await post(app, '/api/auth/login', GOOD, '10.0.0.2')).statusCode).toBe(200);
  });

  it('register trả 429 khi vượt 10 lần/15 phút từ cùng IP, IP khác vẫn được', async () => {
    const { app } = setup();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      codes.push((await post(app, '/api/auth/register', { email: `u${i}@b.vn`, password: 'matkhau123' }, '10.0.0.1')).statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true);
    expect(codes[10]).toBe(429);
    const other = await post(app, '/api/auth/register', { email: 'z@b.vn', password: 'matkhau123' }, '10.0.0.2');
    expect(other.statusCode).toBe(201);
  });

  it('X-Forwarded-For bị bỏ qua mặc định; dùng được khi trustProxy bật', async () => {
    const off = setup();
    await post(off.app, '/api/auth/register', GOOD);
    for (let i = 0; i < 5; i++) {
      await post(off.app, '/api/auth/login', BAD, '10.0.0.1', { ...H, 'x-forwarded-for': `1.1.1.${i}` });
    }
    const locked = await post(off.app, '/api/auth/login', GOOD, '10.0.0.1', { ...H, 'x-forwarded-for': '9.9.9.9' });
    expect(locked.statusCode).toBe(429);

    const on = setup({ trustProxy: true });
    await post(on.app, '/api/auth/register', GOOD, '10.0.0.1', { ...H, 'x-forwarded-for': '7.7.7.7' });
    for (let i = 0; i < 5; i++) {
      await post(on.app, '/api/auth/login', BAD, '10.0.0.1', { ...H, 'x-forwarded-for': '8.8.8.8' });
    }
    const other = await post(on.app, '/api/auth/login', GOOD, '10.0.0.1', { ...H, 'x-forwarded-for': '9.9.9.9' });
    expect(other.statusCode).toBe(200);
  });

  it('số scrypt chạy đồng thời không vượt giới hạn', async () => {
    const { app } = setup();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        post(app, '/api/auth/register', { email: `c${i}@b.vn`, password: 'matkhau123' }, '10.0.1.1'),
      ),
    );
    expect(MAX_CONCURRENT_SCRYPT).toBe(4);
    expect(scryptStats.peak).toBeLessThanOrEqual(MAX_CONCURRENT_SCRYPT);
    expect(scryptStats.peak).toBeGreaterThan(0);
  });
});

describe('FND-005 email dài, dọn login_attempts', () => {
  it('email > 254 ký tự bị từ chối, không ghi DB (login và register)', async () => {
    const { app, db } = setup();
    const long = `${'a'.repeat(250)}@b.vn`;
    expect((await post(app, '/api/auth/login', { email: long, password: 'matkhau123' })).statusCode).toBe(401);
    expect((await post(app, '/api/auth/register', { email: long, password: 'matkhau123' })).statusCode).toBe(400);
    expect((await post(app, '/api/auth/login', { email: 'x'.repeat(100000), password: 'p' })).statusCode).toBe(401);
    expect(count(db)).toBe(0);
  });

  it('dòng cũ hơn cửa sổ bị xóa khi ghi', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', GOOD);
    db.prepare("INSERT INTO login_attempts (email, ip, kind, at_ms) VALUES ('old@b.vn', '1.1.1.1', 'login', ?)").run(
      Date.now() - 16 * 60 * 1000,
    );
    await post(app, '/api/auth/login', BAD);
    expect(count(db, "SELECT COUNT(*) c FROM login_attempts WHERE email = 'old@b.vn'")).toBe(0);
  });
});

describe('FND-006 test bổ sung', () => {
  it('hết khóa sau 15 phút (fake timer)', async () => {
    const { app } = setup();
    await post(app, '/api/auth/register', GOOD);
    for (let i = 0; i < 5; i++) await post(app, '/api/auth/login', BAD);
    expect((await post(app, '/api/auth/login', GOOD)).statusCode).toBe(429);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 14 * 60 * 1000);
    expect((await post(app, '/api/auth/login', GOOD)).statusCode).toBe(429);
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    expect((await post(app, '/api/auth/login', GOOD)).statusCode).toBe(200);
  });

  it('email hoa/thường/khoảng trắng dùng chung bộ đếm', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', GOOD);
    const variants = ['a@b.vn', 'A@B.VN', ' a@B.vn ', 'A@b.Vn', 'a@b.vn'];
    for (const email of variants) await post(app, '/api/auth/login', { email, password: 'sai-sai-sai' });
    expect(count(db, "SELECT COUNT(DISTINCT email) c FROM login_attempts WHERE kind = 'login'")).toBe(1);
    expect((await post(app, '/api/auth/login', { email: 'A@B.vn', password: 'matkhau123' })).statusCode).toBe(429);
  });

  it('đăng nhập đúng xóa bộ đếm', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', GOOD);
    for (let i = 0; i < 3; i++) await post(app, '/api/auth/login', BAD);
    expect(count(db, "SELECT COUNT(*) c FROM login_attempts WHERE kind = 'login'")).toBe(3);
    expect((await post(app, '/api/auth/login', GOOD)).statusCode).toBe(200);
    expect(count(db, "SELECT COUNT(*) c FROM login_attempts WHERE kind = 'login'")).toBe(0);
  });

  it('cờ Secure chỉ bật ở production', async () => {
    const { app } = setup();
    const dev = await post(app, '/api/auth/register', GOOD);
    expect(String(dev.headers['set-cookie'])).not.toContain('Secure');
    vi.stubEnv('NODE_ENV', 'production');
    const prod = await post(app, '/api/auth/login', GOOD);
    expect(String(prod.headers['set-cookie'])).toContain('; Secure');
  });
});

describe('FND-007 header bảo mật và dọn phiên', () => {
  it('trang đăng nhập có header chống nhúng; /api/auth/* no-store', async () => {
    const { app } = setup();
    const page = await app.inject({ method: 'GET', url: '/dang-nhap' });
    expect(page.headers['x-frame-options']).toBe('DENY');
    expect(String(page.headers['content-security-policy'])).toContain("frame-ancestors 'none'");
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(page.headers['cache-control']).toBe('no-store');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(me.headers['cache-control']).toBe('no-store');
    const bad = await post(app, '/api/auth/login', BAD);
    expect(bad.headers['cache-control']).toBe('no-store');
  });

  it('tạo phiên mới dọn phiên hết hạn', async () => {
    const { app, db } = setup();
    await post(app, '/api/auth/register', GOOD);
    db.prepare('UPDATE sessions SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
    await post(app, '/api/auth/login', GOOD);
    expect(count(db, 'SELECT COUNT(*) c FROM sessions')).toBe(1);
  });
});
