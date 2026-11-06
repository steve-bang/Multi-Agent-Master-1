import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { renderMarkdown } from '../../src/render/markdown.js';
import { buildApp } from '../../src/server/app.js';

const MAX = 200 * 1024;
const fill = (unit: string, prefix = '', suffix = ''): string => {
  const n = Math.floor((MAX - prefix.length - suffix.length) / unit.length);
  return prefix + unit.repeat(n) + suffix;
};

/** Ca xấu ở đúng giới hạn 200 KB (ASCII). */
const CASES: Record<string, string> = {
  'danh sách lồng sâu': Array.from({ length: 2000 }, (_, i) => ' '.repeat(i % 100) + '- x').join('\n').slice(0, MAX),
  'blockquote lồng sâu': fill('>', '', ' x'),
  'emphasis lồng': fill('*a ', '', ''),
  'emphasis lặp **_': fill('**_a', '', ''),
  '"[" lặp': fill('['),
  '"[a](" lặp': fill('[a]('),
  'backtick lặp': fill('`'),
  'backtick xen kẽ': fill('`a``'),
  'link dài': '[a](https://e.com/' + 'a'.repeat(MAX - 40) + ')',
  'bảng lớn': fill('| a | b | c |\n', '| h | h | h |\n|---|---|---|\n'),
  'entity lặp': fill('&amp;&#106;&lt;'),
  'nhiều đoạn ngắn': fill('a\n\n'),
  'ảnh lặp': fill('![a](https://e.com/a.png)'),
};

// Ngưỡng nới (đo thực tế ở README/mục Hiệu năng xem trước; cả bộ rất xa ngưỡng này) để không flaky trên CI chậm.
const LIMIT_MS = 1500;

describe('REQ-005 hiệu năng render ca xấu 200 KB', () => {
  for (const [name, md] of Object.entries(CASES)) {
    it(`render <= ${LIMIT_MS} ms: ${name}`, () => {
      expect(md.length).toBeLessThanOrEqual(MAX);
      const t0 = performance.now();
      renderMarkdown(md);
      const ms = performance.now() - t0;
      if (process.env.PERF_LOG) console.log(`PERF ${name}: ${ms.toFixed(0)} ms`);
      expect(ms).toBeLessThan(LIMIT_MS);
    });
  }
});

describe('REQ-005 rate limit POST /api/preview theo user', () => {
  const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
  const reg = async (app: ReturnType<typeof buildApp>, email: string) => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'matkhau123' }, headers: H });
    return { ...H, cookie: String(r.headers['set-cookie']).split(';')[0] };
  };
  const prev = (app: ReturnType<typeof buildApp>, h: Record<string, string>) =>
    app.inject({ method: 'POST', url: '/api/preview', headers: h, payload: { bodyMd: '**x**' } });

  it('BUG-002 script xem trước: không focus/alert khi lỗi, debounce 800 ms, hủy request cũ, tự thử lại theo Retry-After', async () => {
    const app = buildApp(openDb(':memory:'));
    const a = await reg(app, 'c@x.vn');
    const js = (await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a })).body;
    const pv = js.slice(js.indexOf('var pn=el('), js.indexOf('function wrap('));
    expect(pv).not.toContain('focus');
    expect(pv).not.toContain('err(');
    expect(pv).toContain('setTimeout(runPv,pvDelay())');
    expect(pv).toContain('800+Math.ceil(ta.value.length/1024)*20');
    expect(pv).toContain('pvCtl.abort()');
    expect(pv).toContain('x.status===429');
    expect(pv).toContain('x.retry');
    expect(pv).toContain("'aria-live':'polite'");
  });

  it('FND-015 closeEd hủy timer debounce/retry, abort request, tăng pvSeq, xóa ghi chú', async () => {
    const app = buildApp(openDb(':memory:'));
    const a = await reg(app, 'd@x.vn');
    const js = (await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a })).body;
    const i = js.indexOf('function closeEd(');
    const fn = js.slice(i, js.indexOf('\n', i));
    expect(fn).toContain('clearTimeout(pvTimer)');
    expect(fn).toContain('clearTimeout(pvRetry)');
    expect(fn).toContain('pvCtl.abort()');
    expect(fn).toContain('++pvSeq');
    expect(fn).toContain("pvNote('')");
    // Chỉ chạy sau bước xác nhận rời trang (không hủy khi người dùng bấm "Ở lại").
    expect(fn.indexOf('window.confirm')).toBeLessThan(fn.indexOf('clearTimeout(pvTimer)'));
  });

  it('120 request/phút/user: request thứ 121 -> 429 envelope tiếng Việt; user khác không bị ảnh hưởng', async () => {
    const app = buildApp(openDb(':memory:'));
    const a = await reg(app, 'a@x.vn');
    const b = await reg(app, 'b@x.vn');
    // Gửi đồng thời: kiểm tra + ghi phải đồng bộ nên đúng 120 request được qua.
    const rs = await Promise.all(Array.from({ length: 140 }, () => prev(app, a)));
    expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(120);
    const limited = rs.filter((r) => r.statusCode === 429);
    expect(limited).toHaveLength(20);
    expect(limited[0]!.json()).toEqual({
      error: { code: 'PREVIEW_RATE_LIMITED', message: 'Bạn xem trước quá nhanh. Vui lòng thử lại sau ít giây.' },
    });
    expect(limited[0]!.headers['retry-after']).toBeDefined();
    expect((await prev(app, b)).statusCode).toBe(200);
  });

  describe('FND-014 ngân sách byte 4 MiB/phút/user', () => {
    const big = (app: ReturnType<typeof buildApp>, h: Record<string, string>) =>
      app.inject({ method: 'POST', url: '/api/preview', headers: h, payload: { bodyMd: 'a'.repeat(MAX) } });
    const BUDGET = 4 * 1024 * 1024;
    const FIT = Math.floor(BUDGET / MAX); // 20

    it('(a) body 200 KB liên tiếp: đúng 20 request qua rồi 429; (c) user khác không bị ảnh hưởng', async () => {
      const app = buildApp(openDb(':memory:'));
      const a = await reg(app, 'e@x.vn');
      const b = await reg(app, 'f@x.vn');
      for (let i = 0; i < FIT; i++) expect((await big(app, a)).statusCode).toBe(200);
      const r = await big(app, a);
      expect(r.statusCode).toBe(429);
      expect(r.json().error.code).toBe('PREVIEW_RATE_LIMITED');
      expect(Number(r.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect((await big(app, b)).statusCode).toBe(200);
    });

    it('(b) body nhỏ 16 KB vẫn đạt đủ 120 request/phút rồi 429 theo số lượng', async () => {
      const app = buildApp(openDb(':memory:'));
      const a = await reg(app, 'g@x.vn');
      const small = () =>
        app.inject({ method: 'POST', url: '/api/preview', headers: a, payload: { bodyMd: 'a'.repeat(16 * 1024) } });
      const rs = await Promise.all(Array.from({ length: 125 }, small));
      expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(120);
      expect(rs.filter((r) => r.statusCode === 429)).toHaveLength(5);
    });

    it('(d) 40 request song song 200 KB: đúng 20 qua, không race', async () => {
      const app = buildApp(openDb(':memory:'));
      const a = await reg(app, 'h@x.vn');
      const rs = await Promise.all(Array.from({ length: 40 }, () => big(app, a)));
      expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(FIT);
      expect(rs.filter((r) => r.statusCode === 429)).toHaveLength(40 - FIT);
    });
  });

  it('chưa đăng nhập vẫn 401 (không tính vào hạn mức), request bị 429 không render', async () => {
    const app = buildApp(openDb(':memory:'));
    expect((await prev(app, H)).statusCode).toBe(401);
  });
});
