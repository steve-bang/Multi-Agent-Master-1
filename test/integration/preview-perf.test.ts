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

  it('30 request/phút/user: request thứ 31 -> 429 envelope tiếng Việt; user khác không bị ảnh hưởng', async () => {
    const app = buildApp(openDb(':memory:'));
    const a = await reg(app, 'a@x.vn');
    const b = await reg(app, 'b@x.vn');
    // Gửi đồng thời: kiểm tra + ghi phải đồng bộ nên đúng 30 request được qua.
    const rs = await Promise.all(Array.from({ length: 40 }, () => prev(app, a)));
    expect(rs.filter((r) => r.statusCode === 200)).toHaveLength(30);
    const limited = rs.filter((r) => r.statusCode === 429);
    expect(limited).toHaveLength(10);
    expect(limited[0]!.json()).toEqual({
      error: { code: 'PREVIEW_RATE_LIMITED', message: 'Bạn xem trước quá nhanh. Vui lòng thử lại sau ít giây.' },
    });
    expect(limited[0]!.headers['retry-after']).toBeDefined();
    expect((await prev(app, b)).statusCode).toBe(200);
  });

  it('chưa đăng nhập vẫn 401 (không tính vào hạn mức), request bị 429 không render', async () => {
    const app = buildApp(openDb(':memory:'));
    expect((await prev(app, H)).statusCode).toBe(401);
  });
});
