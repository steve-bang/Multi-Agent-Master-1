import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { renderLayer1, renderMarkdown, sanitizeLayer2, validateLink } from '../../src/render/markdown.js';
import { buildApp } from '../../src/server/app.js';

const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
type App = ReturnType<typeof buildApp>;

async function user(app: App, email: string): Promise<Record<string, string>> {
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'matkhau123' },
    headers: H,
  });
  return { ...H, cookie: String(r.headers['set-cookie']).split(';')[0] };
}
const setup = async () => {
  const db = openDb(':memory:');
  const app = buildApp(db);
  const a = await user(app, 'a@x.vn');
  const b = await user(app, 'b@x.vn');
  const call = (h: Record<string, string>, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: h, ...(payload ? { payload } : {}) });
  const sp = (await call(a, 'POST', '/api/spaces', { title: 'S' })).json().space.id as number;
  const pid = (await call(a, 'POST', `/api/spaces/${sp}/pages`, { title: 'P' })).json().page.id as number;
  return { app, db, a, b, call, pid };
};

const XSS: [string, string][] = [
  ['script', '<script>alert(1)</script>'],
  ['onerror', '<img src=x onerror=alert(1)>'],
  ['js link', '[x](javascript:alert(1))'],
  ['js link upper', '[x](JaVaScRiPt:alert(1))'],
  ['js link entity', '[x](&#106;avascript:alert(1))'],
  ['js link tab', '[x](java\tscript:alert(1))'],
  ['js link angle', '[x](<javascript:alert(1)>)'],
  ['js link space', '[x]( javascript:alert(1))'],
  ['data link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
  ['vbscript', '[x](vbscript:msgbox(1))'],
  ['js image', '![x](javascript:alert(1))'],
  ['data image', '![x](data:image/svg+xml;base64,PHN2Zz4=)'],
  ['svg', '<svg onload=alert(1)><circle/></svg>'],
  ['iframe', '<iframe src="https://evil.example"></iframe>'],
  ['entity', '&lt;script&gt;alert(1)&lt;/script&gt; &#60;script&#62;'],
  ['nested', '> - **[a](javascript:alert(1))** <b onclick=alert(1)>x</b>'],
  ['style', '<p style="x:expression(alert(1))">x</p>'],
  ['ref link', '[x][r]\n\n[r]: javascript:alert(1)'],
  ['autolink', '<javascript:alert(1)>'],
  ['details ontoggle', '<details open ontoggle=alert(1)><summary>x</summary></details>'],
  ['math', '<math><mi xlink:href=javascript:alert(1)>x</mi></math>'],
  ['heading html', '# <img src=x onerror=alert(1)> tiêu đề <script>alert(1)</script>'],
  ['setext heading html', '<b onmouseover=alert(1)>x</b>\n===='],
  ['code block html', '```html\n<script>alert(1)</script><img src=x onerror=alert(1)>\n```'],
  ['inline code html', '`<script>alert(1)</script>`'],
  ['indented code html', '    <script>alert(1)</script>'],
  ['table html', '| a |\n|---|\n| <script>alert(1)</script> |'],
];

describe('REQ-005 render an toàn', () => {
  for (const [name, md] of XSS) {
    it(`REQ-005 XSS chặn: ${name}`, () => {
      const html = renderMarkdown(md);
      expect(html).not.toMatch(/<script|<iframe|<svg|<style/i);
      expect(html).not.toMatch(/<[^>]*\son\w+\s*=/i);
      expect(html).not.toMatch(/<[^>]*\sstyle\s*=/i);
      expect(html).not.toMatch(/(href|src)\s*=\s*"[^"]*(javascript|vbscript|data)\s*:/i);
    });
  }

  // Kiểm từng lớp độc lập để hồi quy một lớp không bị lớp kia che.
  it('REQ-005 lớp 1 validateLink: chặn scheme nguy hiểm, cho phép http/https/mailto/#', () => {
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:x', ' javascript:x', 'java\tscript:x', 'java​script:x', 'vbscript:x', 'data:text/html,x', 'file:///etc/passwd', '//evil.example', '/local'])
      expect(validateLink(u), u).toBe(false);
    for (const u of ['https://e.com', 'http://e.com', 'mailto:a@e.com', '#muc'])
      expect(validateLink(u), u).toBe(true);
  });

  it('REQ-005 lớp 1 markdown-it (chưa sanitize): không sinh thẻ nguy hiểm / link javascript', () => {
    expect(renderLayer1('<script>alert(1)</script>')).not.toMatch(/<script/i);
    expect(renderLayer1('<img src=x onerror=alert(1)>')).not.toMatch(/<img/i);
    expect(renderLayer1('[x](javascript:alert(1))')).not.toMatch(/<a\b/i);
    expect(renderLayer1('![x](javascript:alert(1))')).not.toMatch(/<img/i);
    expect(renderLayer1('<details ontoggle=alert(1)>')).not.toMatch(/<details/i);
  });

  it('REQ-005 lớp 2 sanitize-html độc lập: bỏ thẻ/thuộc tính/scheme nguy hiểm trong HTML thô', () => {
    const out = sanitizeLayer2(
      '<script>a</script><a href="javascript:x" onclick="y">l</a><img src="data:image/png;base64,AA" onerror="z"><details ontoggle="q"><summary>s</summary></details><math><mi>m</mi></math><p style="x:y">p</p>',
    );
    expect(out).not.toMatch(/<script|javascript:|onclick|onerror|ontoggle|<details|<math|style=|data:/i);
  });

  it('REQ-005 giữ lại http/https/mailto, link ngoài có rel an toàn', () => {
    const html = renderMarkdown('[a](https://e.com) [b](http://e.com) [c](mailto:a@e.com)');
    expect(html).toContain('href="https://e.com"');
    expect(html).toContain('href="mailto:a@e.com"');
    expect(html.match(/rel="noopener noreferrer nofollow"/g)?.length).toBe(3);
  });

  it('REQ-005 ảnh chỉ http/https', () => {
    expect(renderMarkdown('![a](https://e.com/a.png)')).toContain('src="https://e.com/a.png"');
    expect(renderMarkdown('![a](http://e.com/a.png)')).toContain('src="http://e.com/a.png"');
    expect(renderMarkdown('![a](mailto:a@e.com)')).not.toContain('<img');
    expect(renderMarkdown('![a](/local.png)')).not.toContain('src="/local.png"');
  });

  it('REQ-005 render tiêu đề, danh sách, code, bảng, đậm, nghiêng', () => {
    const html = renderMarkdown(
      '# T\n\n- a\n- b\n\n1. x\n\n`c`\n\n```\ncode <b>\n```\n\n| h1 | h2 |\n|---|---|\n| 1 | 2 |\n\n**d** *n*',
    );
    for (const t of ['<h1>', '<ul>', '<ol>', '<code>', '<pre>', '<table>', '<th>', '<td>', '<strong>d', '<em>n'])
      expect(html).toContain(t);
    expect(html).toContain('code &lt;b&gt;');
  });

  it('REQ-005 giữ tiếng Việt có dấu', () => {
    expect(renderMarkdown('Xin **chào** thế giới')).toContain('Xin <strong>chào</strong> thế giới');
  });
});

describe('REQ-005 API', () => {
  it('REQ-005 lưu và đọc bodyMd cùng title, nguyên tử', async () => {
    const { call, a, pid } = await setup();
    expect((await call(a, 'GET', `/api/pages/${pid}`)).json().page.bodyMd).toBe('');
    const r = await call(a, 'PATCH', `/api/pages/${pid}`, { title: 'Mới', bodyMd: '# Xin chào\n<script>x</script>' });
    expect(r.statusCode).toBe(200);
    const g = (await call(a, 'GET', `/api/pages/${pid}`)).json().page;
    expect(g.title).toBe('Mới');
    expect(g.bodyMd).toBe('# Xin chào\n<script>x</script>'); // lưu Markdown gốc
  });

  it('REQ-005 chỉ bodyMd không đổi title; chỉ title không xóa bodyMd', async () => {
    const { call, a, pid } = await setup();
    await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'nội dung' });
    let g = (await call(a, 'GET', `/api/pages/${pid}`)).json().page;
    expect([g.title, g.bodyMd]).toEqual(['P', 'nội dung']);
    await call(a, 'PATCH', `/api/pages/${pid}`, { title: 'Q' });
    g = (await call(a, 'GET', `/api/pages/${pid}`)).json().page;
    expect([g.title, g.bodyMd]).toEqual(['Q', 'nội dung']);
  });

  it('REQ-005 title sai thì bodyMd cũng không được ghi (nguyên tử)', async () => {
    const { call, a, pid } = await setup();
    const r = await call(a, 'PATCH', `/api/pages/${pid}`, { title: '  ', bodyMd: 'x' });
    expect(r.statusCode).toBe(400);
    expect((await call(a, 'GET', `/api/pages/${pid}`)).json().page.bodyMd).toBe('');
  });

  it('REQ-005 bodyMd không phải chuỗi -> 400 INVALID_INPUT; body rỗng -> 400', async () => {
    const { call, a, pid } = await setup();
    const r = await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: 5 });
    expect([r.statusCode, r.json().error.code]).toEqual([400, 'INVALID_INPUT']);
    expect((await call(a, 'PATCH', `/api/pages/${pid}`, {})).statusCode).toBe(400);
  });

  it('REQ-005 vượt giới hạn 200 KB -> 400 TOO_LARGE tiếng Việt, không ghi', async () => {
    const { call, a, pid } = await setup();
    const big = 'a'.repeat(200 * 1024 + 1);
    const r = await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: big });
    expect([r.statusCode, r.json().error.code]).toEqual([400, 'TOO_LARGE']);
    expect(r.json().error.message).toMatch(/200 KB/);
    expect((await call(a, 'GET', `/api/pages/${pid}`)).json().page.bodyMd).toBe('');
    const p = await call(a, 'POST', '/api/preview', { bodyMd: big });
    expect([p.statusCode, p.json().error.code]).toEqual([400, 'TOO_LARGE']);
    expect((await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'a'.repeat(200 * 1024) })).statusCode).toBe(200);
  });

  it('REQ-005 giới hạn tính theo byte UTF-8', async () => {
    const { call, a, pid } = await setup();
    const r = await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'ế'.repeat(70000) }); // 3 byte/ký tự
    expect(r.json().error.code).toBe('TOO_LARGE');
  });

  it('REQ-005 POST /api/preview trả html đã sanitize', async () => {
    const { call, a } = await setup();
    const r = await call(a, 'POST', '/api/preview', { bodyMd: '**x** <script>alert(1)</script>' });
    expect(r.statusCode).toBe(200);
    expect(r.json().html).toContain('<strong>x</strong>');
    expect(r.json().html).not.toMatch(/<script/i);
    expect((await call(a, 'POST', '/api/preview', { bodyMd: 1 })).statusCode).toBe(400);
  });

  it('REQ-005 401 khi chưa đăng nhập (preview, patch, get)', async () => {
    const { call, pid } = await setup();
    expect((await call(H, 'POST', '/api/preview', { bodyMd: 'x' })).statusCode).toBe(401);
    expect((await call(H, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'x' })).statusCode).toBe(401);
    expect((await call(H, 'GET', `/api/pages/${pid}`)).statusCode).toBe(401);
  });

  it('REQ-005 Origin sai -> 403 cho preview và PATCH', async () => {
    const { call, a, pid } = await setup();
    const bad = { ...a, origin: 'http://evil.example' };
    expect((await call(bad, 'POST', '/api/preview', { bodyMd: 'x' })).statusCode).toBe(403);
    const r = await call(bad, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'x' });
    expect(r.statusCode).toBe(403);
    expect((await call(a, 'GET', `/api/pages/${pid}`)).json().page.bodyMd).toBe('');
  });

  it('REQ-005 IDOR: người khác đọc/sửa trang -> 404 và không đổi dữ liệu, không lộ nội dung', async () => {
    const { call, a, b, pid } = await setup();
    await call(a, 'PATCH', `/api/pages/${pid}`, { bodyMd: 'bí mật' });
    const g = await call(b, 'GET', `/api/pages/${pid}`);
    expect(g.statusCode).toBe(404);
    expect(g.body).not.toContain('bí mật');
    const p = await call(b, 'PATCH', `/api/pages/${pid}`, { title: 'hack', bodyMd: 'hack' });
    expect(p.statusCode).toBe(404);
    const o = (await call(a, 'GET', `/api/pages/${pid}`)).json().page;
    expect([o.title, o.bodyMd]).toEqual(['P', 'bí mật']);
  });

  it('REQ-005 tạo trang kèm bodyMd (hợp đồng); cây trang không chứa bodyMd', async () => {
    const { call, a } = await setup();
    const sp = (await call(a, 'POST', '/api/spaces', { title: 'Z' })).json().space.id;
    const r = await call(a, 'POST', `/api/spaces/${sp}/pages`, { title: 'N', bodyMd: 'abc' });
    expect(r.statusCode).toBe(201);
    expect((await call(a, 'GET', `/api/pages/${r.json().page.id}`)).json().page.bodyMd).toBe('abc');
    expect(JSON.stringify((await call(a, 'GET', `/api/spaces/${sp}/tree`)).json())).not.toContain('abc');
  });
});

describe('REQ-005 Studio', () => {
  it('REQ-005 CSP cho ảnh http/https, script soạn thảo là file ngoài, preview dùng iframe sandbox', async () => {
    const { app, a } = await setup();
    const page = await app.inject({ method: 'GET', url: '/studio', headers: a });
    expect(String(page.headers['content-security-policy'])).toContain("img-src 'self' http: https:");
    expect(page.body).not.toMatch(/<script(?![^>]*src=)/i);
    // Lớp phòng thủ chính của preview: thuộc tính sandbox rỗng (không allow-*) trên iframe trong HTML /studio.
    const tag = page.body.match(/<iframe\b[^>]*\bid="ed-preview"[^>]*>/)?.[0] ?? '';
    expect(tag).not.toBe('');
    expect(tag).toMatch(/\ssandbox=""(\s|>)/);
    expect(tag).not.toMatch(/allow-/);
    expect(tag).not.toMatch(/\ssrc=/);
    expect(page.body.match(/<iframe\b/g)).toHaveLength(1);
    const js = await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a });
    expect(js.body).not.toMatch(/setAttribute\(\s*['"]sandbox['"]/);
    expect(js.body).toContain('beforeunload');
    expect(js.body).not.toMatch(/innerHTML\s*=/);
  });
});
