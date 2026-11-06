import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { contrastRatio, parseTokens } from '../../src/render/tokens.js';
import { buildApp } from '../../src/server/app.js';

const CSS_DIR = join(process.cwd(), 'src', 'assets', 'css');
const tokensCss = readFileSync(join(CSS_DIR, 'tokens.css'), 'utf8');
const tokens = new Map(parseTokens(tokensCss).map((x) => [x.name, x.value]));
const tok = (n: string): string => {
  const v = tokens.get(n);
  if (!v) throw new Error(`thiếu token ${n}`);
  return v;
};
const HEX = /#[0-9a-fA-F]{3,8}\b/;

describe('REQ-007 T-011 tương phản WCAG từ tokens.css thật', () => {
  const text: Array<[string, string, string]> = [
    ['chữ / nền', 'color-text', 'color-bg'],
    ['chữ / bề mặt', 'color-text', 'color-surface'],
    ['chữ phụ / nền', 'color-text-muted', 'color-bg'],
    ['chữ phụ / bề mặt', 'color-text-muted', 'color-surface'],
    ['chữ trắng / primary', 'color-on-primary', 'color-primary'],
    ['chữ trắng / primary hover', 'color-on-primary', 'color-primary-hover'],
    ['chữ trắng / primary active', 'color-on-primary', 'color-primary-active'],
    ['chữ trắng / nguy hiểm', 'color-on-primary', 'color-error'],
    ['chữ trắng / nguy hiểm hover', 'color-on-primary', 'color-error-hover'],
    ['lỗi / error-bg', 'color-error', 'color-error-bg'],
    ['lỗi / nền', 'color-error', 'color-bg'],
    ['thành công / success-bg', 'color-success', 'color-success-bg'],
    ['cảnh báo (429) / warning-bg', 'color-warning', 'color-warning-bg'],
    ['liên kết / nền', 'color-primary-hover', 'color-bg'],
    ['chữ / mục hiện tại', 'color-text', 'color-current-bg'],
    ['chữ / hover', 'color-text', 'color-hover-bg'],
    ['lỗi / hover ghost', 'color-error', 'color-error-bg'],
  ];
  it.each(text)('chữ %s >= 4.5:1', (_n, fg, bg) => {
    expect(contrastRatio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5);
  });

  const ui: Array<[string, string, string]> = [
    ['viền ô nhập / nền', 'color-border', 'color-bg'],
    ['viền ô nhập / bề mặt', 'color-border', 'color-surface'],
    ['focus ring / nền', 'color-focus', 'color-bg'],
    ['focus ring / bề mặt', 'color-focus', 'color-surface'],
    ['focus ring / hover', 'color-focus', 'color-hover-bg'],
    ['viền lỗi / nền', 'color-error', 'color-bg'],
  ];
  it.each(ui)('thành phần UI %s >= 3:1', (_n, fg, bg) => {
    expect(contrastRatio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(3);
  });

  it('khớp bản thiết kế: primary/focus/border và công thức tương phản', () => {
    expect(tok('color-primary')).toBe('#2563EB');
    expect(tok('color-focus')).toBe('#1D4ED8');
    expect(tok('color-border')).toBe('#6B7280');
    expect(tok('focus-ring-width')).toBe('2px');
    expect(tok('focus-ring-offset')).toBe('2px');
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(tok('size-sidebar')).toBe('280px');
    expect(tok('tree-indent')).toBe('16px');
  });
});

describe('REQ-007 T-011 không viết cứng mã màu ngoài tokens.css', () => {
  it('src/render và app.css không chứa mã màu hex', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'render')).map((f) => join(process.cwd(), 'src', 'render', f));
    files.push(join(CSS_DIR, 'app.css'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(HEX);
    expect(tokensCss).toMatch(HEX); // phát hiện regex hỏng: tokens.css thì phải có
  });
});

describe('REQ-007 T-011 route tài sản và /design-tokens', () => {
  const app = buildApp(openDb(':memory:'));

  it.each(['/assets/tokens.css', '/assets/app.css'])('%s 200 text/css công khai (không cookie)', async (url) => {
    const r = await app.inject({ method: 'GET', url });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/css; charset=utf-8');
    expect(String(r.headers['cache-control'])).toContain('max-age');
  });

  it('tokens.css phục vụ đúng nội dung tệp; app.css dùng var(--...)', async () => {
    expect((await app.inject({ method: 'GET', url: '/assets/tokens.css' })).body).toBe(tokensCss);
    const css = (await app.inject({ method: 'GET', url: '/assets/app.css' })).body;
    expect(css).toContain('var(--color-primary)');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('font-display: swap');
  });

  it('font woff2 latin + vietnamese phục vụ công khai; tên lạ -> 404 (không đọc đường dẫn tùy ý)', async () => {
    for (const f of ['inter-latin-wght-normal.woff2', 'inter-vietnamese-wght-normal.woff2']) {
      const r = await app.inject({ method: 'GET', url: `/assets/fonts/${f}` });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toBe('font/woff2');
      expect(r.rawPayload.length).toBeGreaterThan(1000);
    }
    expect((await app.inject({ method: 'GET', url: '/assets/fonts/..%2F..%2Fpackage.json' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/assets/fonts/inter-cyrillic-wght-normal.woff2' })).statusCode).toBe(404);
  });

  it('/design-tokens 200 công khai, liệt kê mọi token màu/khoảng cách/bo góc/chữ trong tokens.css', async () => {
    const r = await app.inject({ method: 'GET', url: '/design-tokens' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    for (const [name, value] of tokens) {
      if (/^(color|space|radius)-/.test(name) || /^font-size-/.test(name)) expect(r.body, name).toContain(name);
      if (name.startsWith('color-') && value.startsWith('#')) expect(r.body, name).toContain(value);
    }
    for (const g of ['Màu', 'Chữ', 'Khoảng cách', 'Bo góc', 'Nút chính', 'Nút phụ', 'Nút nguy hiểm', 'Ô nhập', 'Vòng focus', 'Vô hiệu hóa']) {
      expect(r.body).toContain(g);
    }
    expect(r.body).toMatch(/\d+\.\d:1 trên nền trắng/);
    expect(r.body).toContain('rel="stylesheet" href="/assets/tokens.css"');
    expect(r.body).not.toMatch(/<style|\sstyle=/i);
    const d = await app.inject({ method: 'GET', url: '/assets/design-tokens.css' });
    expect(d.statusCode).toBe(200);
    expect(d.body).toContain('.sw-color-primary{background:var(--color-primary)}');
  });

  it('trang đăng ký/đăng nhập/studio dùng <link> CSS, không còn <style>; CSP style-src chặt', async () => {
    for (const url of ['/dang-ky', '/dang-nhap']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.body).toContain('href="/assets/tokens.css"');
      expect(r.body).toContain('href="/assets/app.css"');
      expect(r.body).not.toMatch(/<style|\sstyle=/i);
      const csp = String(r.headers['content-security-policy']);
      expect(csp).toContain("style-src 'self';");
      expect(csp).toContain("font-src 'self'");
      expect(csp).not.toContain('unsafe-inline');
    }
  });
});
