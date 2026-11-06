import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { buildApp } from '../../src/server/app.js';

const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
const csp = async (): Promise<string> => {
  const app = buildApp(openDb(':memory:'));
  const r = await app.inject({ method: 'GET', url: '/healthz' });
  return String(r.headers['content-security-policy']);
};

describe('T-007 CSP img-src theo môi trường', () => {
  const orig = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = orig;
  });
  it('production: chỉ self + https:, không có http:', async () => {
    process.env.NODE_ENV = 'production';
    const c = await csp();
    expect(c).toContain("img-src 'self' https:;");
    expect(c).not.toMatch(/img-src[^;]*\shttp:/);
  });
  it('development: thêm http:', async () => {
    process.env.NODE_ENV = 'development';
    expect(await csp()).toContain("img-src 'self' http: https:;");
  });
  it('không đặt NODE_ENV: coi là production (fail-closed), không có http:', async () => {
    delete process.env.NODE_ENV;
    const c = await csp();
    expect(c).toContain("img-src 'self' https:;");
    expect(c).not.toMatch(/img-src[^;]*\shttp:/);
  });
});

describe('T-007 cờ Secure của cookie theo môi trường', () => {
  const orig = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = orig;
  });
  const cookie = async (): Promise<string> => {
    const app = buildApp(openDb(':memory:'));
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', headers: H, payload: { email: 'a@x.vn', password: 'matkhau123' } });
    return String(r.headers['set-cookie']);
  };
  it('không đặt NODE_ENV -> Secure; production -> Secure; development -> không Secure', async () => {
    delete process.env.NODE_ENV;
    expect(await cookie()).toContain('; Secure');
    process.env.NODE_ENV = 'production';
    expect(await cookie()).toContain('; Secure');
    process.env.NODE_ENV = 'development';
    expect(await cookie()).not.toContain('Secure');
  });
});

describe('T-007 route không tồn tại', () => {
  it('404 envelope tiếng Việt, không phải JSON mặc định của Fastify', async () => {
    const app = buildApp(openDb(':memory:'));
    const r = await app.inject({ method: 'GET', url: '/khong-co-route-nay' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy.' } });
    expect(r.body).not.toContain('Route GET');
  });
});

describe('T-007 lỗi 5xx', () => {
  it('ghi log phía server, client chỉ nhận thông báo cố định tiếng Việt', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = buildApp(openDb(':memory:'));
    app.get('/boom', () => {
      throw new Error('chi tiết nội bộ bí mật');
    });
    const r = await app.inject({ method: 'GET', url: '/boom', headers: H });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ error: { code: 'INTERNAL', message: 'Lỗi hệ thống.' } });
    expect(r.body).not.toContain('bí mật');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![1])).toContain('chi tiết nội bộ bí mật');
    spy.mockRestore();
  });
});
