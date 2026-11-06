// T-011 audit: CSP/console, tràn ngang, vùng chạm, focus ring, thứ tự Tab, skip link, reduced-motion, iframe preview.
const { chromium } = require('playwright');
const BASE = process.env.BASE;
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const md = '# Tiêu đề\n\nĐoạn **đậm** tiếng Việt.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nx\n```\n\n- a\n- b\n\n> trích\n';
(async () => {
  const browser = await chromium.launch();
  const mk = async (w, h = 800, extra = {}) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, ...extra });
    const p = await c.newPage(); p.on('dialog', (d) => d.accept('Mục thử'));
    p.cons = []; p.errs = [];
    p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) p.cons.push(m.type() + ': ' + m.text().slice(0, 200)); });
    p.on('pageerror', (e) => p.errs.push(e.message));
    p.on('requestfailed', (r) => p.cons.push('requestfailed: ' + r.url()));
    p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/')) p.cons.push('http' + r.status() + ': ' + r.url()); });
    await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI), true); });
    return { c, p };
  };
  const api = (p, m, u, b) => p.evaluate(async ([m, u, b]) => { const r = await fetch(u, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return j; }, [m, u, b]);

  async function measure(p, label, w) {
    const r = await p.evaluate((w) => {
      const de = document.documentElement;
      const res = { sw: de.scrollWidth, cw: de.clientWidth, small: [], noRing: [], order: [], anim: [], csp: window.__csp.slice() };
      const sel = 'a[href],button,input,select,textarea,summary,[tabindex]';
      for (const e of document.querySelectorAll(sel)) {
        const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        if (b.width === 0 || b.height === 0 || cs.visibility === 'hidden' || e.closest('[hidden]')) continue;
        if (e.classList.contains('skip-link')) continue;
        const id = (e.id || e.className || e.tagName) + ':' + (e.textContent || e.value || '').trim().slice(0, 12);
        if (b.height < 44 || (b.width < 44 && e.tagName !== 'A')) res.small.push(`${id} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      for (const e of document.querySelectorAll('*')) {
        const cs = getComputedStyle(e);
        if ((cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0) || cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) res.anim.push(e.tagName + '.' + (e.id || e.className) + ' ' + cs.animationName + '/' + cs.transitionDuration);
      }
      return res;
    }, w);
    // tab walk
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.mouse.click(0, 0).catch(() => {});
    const seen = []; const bad = [];
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press('Tab');
      const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { k: (e.id || e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')), ow: cs.outlineWidth, os: cs.outlineStyle, sh: cs.boxShadow !== 'none', bx: e.getBoundingClientRect().height, tag: e.tagName }; });
      if (!s) break; if (seen.includes(s.k)) break; seen.push(s.k);
      if (s.os === 'none' || s.ow !== '2px') bad.push(`${s.k}:${s.os} ${s.ow} shadow=${s.sh}`);
    }
    log(`[${label}@${w}] overflow=${r.sw > r.cw ? 'CÓ' : 'không'} (${r.sw}/${r.cw}) csp=${JSON.stringify(r.csp)} console=${JSON.stringify(p.cons)} pageerror=${JSON.stringify(p.errs)}`);
    log(`   vùng chạm <44: ${JSON.stringify(r.small)}`);
    log(`   Tab order: ${seen.join(' > ')}`);
    log(`   focus ring không phải solid 2px: ${JSON.stringify(bad)}`);
    log(`   animation/transition còn lại: ${JSON.stringify(r.anim.slice(0, 6))} (n=${r.anim.length})`);
  }

  // Tạo dữ liệu
  const setup = await mk(1280); const email = `a${Date.now()}@example.vn`;
  await setup.p.goto(BASE + '/dang-ky'); await setup.p.fill('#email', email); await setup.p.fill('#password', 'matkhau-12345'); await setup.p.click('#auth-form button[type=submit]'); await setup.p.waitForURL('**/studio');
  const sp = await api(setup.p, 'POST', '/api/spaces', { title: 'Tài liệu sản phẩm' }); const sid = (sp.space || sp).id;
  const p1 = await api(setup.p, 'POST', `/api/spaces/${sid}/pages`, { title: 'Bắt đầu', parentId: null, bodyMd: md });
  await api(setup.p, 'POST', `/api/spaces/${sid}/pages`, { title: 'Con', parentId: (p1.page || p1).id, bodyMd: 'x' });
  const cookies = await setup.c.cookies();

  for (const w of [360, 768, 1280, 1440]) {
    // công khai
    for (const [lab, path] of [['dang-ky', '/dang-ky'], ['dang-nhap', '/dang-nhap'], ['design-tokens', '/design-tokens'], ['404', '/khong-co']]) {
      const { c, p } = await mk(w); await p.goto(BASE + path); await p.waitForTimeout(400); await measure(p, lab, w); await c.close();
    }
    const { c, p } = await mk(w); await c.addCookies(cookies);
    await p.goto(BASE + '/studio'); await p.waitForTimeout(500); await measure(p, 'studio-ds', w);
    await p.getByRole('button', { name: 'Mở', exact: true }).first().click(); await p.waitForTimeout(500); await measure(p, 'studio-cay', w);
    await p.getByRole('button', { name: 'Soạn', exact: true }).first().click(); await p.waitForSelector('#ed-panel:not([hidden])'); await p.waitForTimeout(1500);
    await measure(p, 'editor', w);
    if (w === 1280 || w === 360) {
      // iframe preview
      const fr = p.frames().find((f) => f !== p.mainFrame());
      const info = await fr.evaluate(async () => { await document.fonts.ready; const h = document.querySelector('h1'); const cs = h && getComputedStyle(h); const bd = getComputedStyle(document.body); return { sheets: document.styleSheets.length, links: [...document.querySelectorAll('link')].map((l) => l.href), h1font: cs && cs.fontFamily, h1size: cs && cs.fontSize, bodyColor: bd.color, bodyFont: bd.fontFamily, fontsLoaded: [...document.fonts].map((f) => f.family + ':' + f.status), tableBorder: (() => { const t = document.querySelector('td,th'); return t && getComputedStyle(t).borderTopWidth; })() }; }).catch((e) => 'ERR ' + e.message);
      log(`[iframe preview@${w}] ${JSON.stringify(info)}`);
      log(`   csp/console tại editor: ${JSON.stringify(await p.evaluate(() => window.__csp))} ${JSON.stringify(p.cons)}`);
    }
    await c.close();
  }
  // skip link
  for (const path of ['/dang-nhap', '/design-tokens', '/studio']) {
    const { c, p } = await mk(1280); if (path === '/studio') await c.addCookies(cookies);
    await p.goto(BASE + path); await p.waitForTimeout(300); await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const e = document.activeElement; const b = e.getBoundingClientRect(); return { cls: e.className, text: e.textContent.trim(), top: b.top, href: e.getAttribute('href') }; });
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    const after = await p.evaluate(() => ({ hash: location.hash, active: document.activeElement.id || document.activeElement.tagName, y: window.scrollY }));
    log(`[skip ${path}] first Tab=${JSON.stringify(f)} sau Enter=${JSON.stringify(after)}`); await c.close();
  }
  // reduced motion
  for (const path of ['/dang-nhap', '/design-tokens', '/studio']) {
    const { c, p } = await mk(1280, 800, { reducedMotion: 'reduce' }); if (path === '/studio') await c.addCookies(cookies);
    await p.goto(BASE + path); await p.waitForTimeout(400);
    if (path === '/studio') { await p.getByRole('button', { name: 'Mở', exact: true }).first().click(); await p.getByRole('button', { name: 'Soạn', exact: true }).first().click(); await p.waitForTimeout(800); }
    const a = await p.evaluate(() => { const r = []; for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if ((cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01) || cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0.01)) r.push(e.tagName + '.' + (e.id || e.className) + ' ' + cs.animationName + '/' + cs.animationDuration + '/' + cs.transitionDuration); } return r; });
    log(`[reduced-motion ${path}] còn animation/transition >10ms: ${JSON.stringify(a.slice(0, 8))} (n=${a.length})`); await c.close();
  }
  // inline style / handler check
  { const { c, p } = await mk(1280); await c.addCookies(cookies); await p.goto(BASE + '/studio');
    await p.getByRole('button', { name: 'Mở', exact: true }).first().click(); await p.getByRole('button', { name: 'Soạn', exact: true }).first().click(); await p.waitForTimeout(800);
    const n = await p.evaluate(() => ({ styleAttr: document.querySelectorAll('[style]').length, onattr: [...document.querySelectorAll('*')].filter((e) => [...e.attributes].some((a) => a.name.startsWith('on'))).length, styleTags: document.querySelectorAll('style').length }));
    log(`[inline] ${JSON.stringify(n)}`); await c.close(); }
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
