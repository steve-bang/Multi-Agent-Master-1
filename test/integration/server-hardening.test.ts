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
  it('không phải production: thêm http:', async () => {
    process.env.NODE_ENV = 'development';
    expect(await csp()).toContain("img-src 'self' http: https:;");
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
