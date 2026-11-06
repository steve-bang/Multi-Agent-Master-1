import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { studioPage } from '../../src/render/studio-page.js';
import { buildApp } from '../../src/server/app.js';

const app = buildApp(openDb(':memory:'));
const studioHtml = studioPage('page');
const studioJs = studioPage('script');
const get = async (url: string): Promise<string> => (await app.inject({ method: 'GET', url })).body;
const css = readFileSync(join(process.cwd(), 'src', 'assets', 'css', 'app.css'), 'utf8');

describe('T-013 UI-1b trang studio', () => {
  it('cây nằm trong <nav aria-label="Mục lục"> giữ id #tree, không còn role tree/treeitem giả', async () => {
    expect(studioHtml).toContain('<nav id="tree" aria-label="Mục lục"></nav>');
    const js = studioJs;
    expect(js).not.toMatch(/treeitem|role:'tree'|role:'group'/);
    expect(js).not.toContain("'sep'");
  });

  it('trang đang soạn có class tree-current + aria-current="page" và viền trái 3px primary', async () => {
    const js = studioJs;
    expect(js).toContain("setAttribute('aria-current','page')");
    expect(js).toContain('tree-current');
    expect(css).toMatch(/\.tree-current > \.tree-row \{[^}]*border-left: 3px solid var\(--color-primary\)/);
  });

  it('skip link có đích tabindex=-1 trên /studio, /dang-nhap, /dang-ky, /design-tokens', async () => {
    expect(studioHtml).toMatch(/<main id="studio"[^>]*tabindex="-1"/);
    for (const u of ['/dang-nhap', '/dang-ky', '/design-tokens']) {
      expect(await get(u), u).toMatch(/<main id="main"[^>]*tabindex="-1"/);
    }
  });

  it('nút Mở >= 44px bằng CSS ở màn hẹp; vùng #pv-note giữ chỗ; trạng thái Đã lưu có dấu tick', async () => {
    expect(css).toMatch(/\.item-actions \.btn-sm \{[^}]*min-width: var\(--size-touch\)/);
    expect(css).toMatch(/\.pv-slot \{ min-height: 3rem; \}/);
    expect(css).toContain('.status-saved::before { content: "\\2713');
    const js = studioJs;
    expect(js).toContain('pv-slot');
    expect(js).toContain('ta.scrollTop=0');
  });

  it('iframe xem trước có vòng focus; outline :focus chỉ còn cho tabindex=-1', () => {
    expect(css).toMatch(/iframe:focus-visible \{ outline: var\(--focus-ring\)/);
    expect(studioHtml).toContain('<iframe id="ed-preview" tabindex="-1"');
    expect(css).toContain('[tabindex="-1"]:focus {');
    expect(css).not.toMatch(/input:focus, textarea:focus, button:focus, a:focus/);
  });
});

describe('T-013 UI-1b biểu mẫu auth và alert', () => {
  it('script auth gắn lỗi vào ô: aria-invalid, aria-describedby, field-error-msg, focus; ánh xạ theo code', async () => {
    const js = await get('/assets/auth.js');
    expect(js).toContain("EMAIL_INVALID:'email'");
    expect(js).toContain("EMAIL_EXISTS:'email'");
    expect(js).toContain("PASSWORD_WEAK:'password'");
    expect(js).toContain("setAttribute('aria-invalid','true')");
    expect(js).toContain("setAttribute('aria-describedby'");
    expect(js).toContain('field-error-msg');
    expect(js).toContain('i.focus()');
    expect(js).not.toMatch(/BAD_CREDENTIALS|RATE_LIMITED/); // sai đăng nhập/khóa luôn ở khung tóm tắt
  });

  it('link chuyển trang nằm trong card, căn giữa; summary vẫn có id error-summary', async () => {
    const html = await get('/dang-nhap');
    expect(html).toMatch(/<p class="auth-alt muted">[^]*<a href="\/dang-ky">[^]*<\/p>\s*<\/div>/);
    expect(html).toContain('id="error-summary"');
    expect(await get('/dang-ky')).toContain('data-hint="pw-hint"');
  });

  it('API vẫn trả code đủ để ánh xạ ô (không đổi hợp đồng)', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/auth/register', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
      payload: { email: 'x', password: 'short' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('EMAIL_INVALID');
  });

  it('alert-success dùng dấu ✓ và role=status; có alert-warning; /design-tokens demo đủ 3 loại', async () => {
    expect(css).toContain('.alert-success::before { content: "\\2713');
    expect(css).toContain('.alert-warning::before');
    expect(css).toContain('\\26A0\\FE0E');
    const html = await get('/design-tokens');
    expect(html).toContain('class="alert alert-success" role="status"');
    expect(html).toContain('class="alert alert-warning"');
    expect(html).toContain('class="alert" role="presentation"');
    expect(html).toMatch(/Chữ trên primary #2563EB: 5\.\d:1\. Đạt AA/);
    expect(html).not.toContain('role="tree"');
  });

  it('.btn-ghost:hover dùng nền hover-bg; không còn .sep; có .ra-group', () => {
    expect(css).toMatch(/\.btn-ghost:hover:not\(:disabled\) \{ background: var\(--color-hover-bg\)/);
    expect(css).not.toContain('.sep');
    expect(css).toContain('.ra-group');
    expect(css).toContain('gap: 4px 8px');
  });
});
