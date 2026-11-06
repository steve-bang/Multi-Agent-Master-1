// T-011: duyệt Tab đầy đủ (khoá theo chỉ số), đo outline và vùng chạm của từng phần tử nhận focus.
const { chromium } = require('playwright');
const BASE = process.env.BASE;
(async () => {
  const browser = await chromium.launch();
  const c0 = await browser.newContext(); const p0 = await c0.newPage();
  await p0.goto(BASE + '/dang-ky'); await p0.fill('#email', `t${Date.now()}@example.vn`); await p0.fill('#password', 'matkhau-12345'); await p0.click('#auth-form button[type=submit]'); await p0.waitForURL('**/studio');
  const api = (m, u, b) => p0.evaluate(async ([m, u, b]) => { const r = await fetch(u, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); return r.json(); }, [m, u, b]);
  const sp = await api('POST', '/api/spaces', { title: 'TL' }); const sid = (sp.space || sp).id;
  const a = await api('POST', `/api/spaces/${sid}/pages`, { title: 'A', parentId: null, bodyMd: '# x' }); await api('POST', `/api/spaces/${sid}/pages`, { title: 'B', parentId: (a.page || a).id, bodyMd: 'y' });
  const cookies = await c0.cookies();
  for (const w of [360, 1280]) {
    const c = await browser.newContext({ viewport: { width: w, height: 800 } }); await c.addCookies(cookies); const p = await c.newPage(); p.on('dialog', (d) => d.accept('Z'));
    await p.goto(BASE + '/studio'); await p.getByRole('button', { name: 'Mở', exact: true }).first().click(); await p.waitForTimeout(400);
    for (const stage of ['tree', 'editor']) {
      if (stage === 'editor') { await p.getByRole('button', { name: 'Soạn', exact: true }).first().click(); await p.waitForSelector('#ed-panel:not([hidden])'); await p.waitForTimeout(1200); }
      await p.evaluate(() => { document.querySelector('.skip-link').focus(); window.scrollTo(0, 0); });
      const rows = []; const bad = []; const small = [];
      for (let i = 0; i < 80; i++) {
        await p.keyboard.press('Tab');
        const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e), b = e.getBoundingClientRect(); const r = e.getBoundingClientRect(); return { k: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ':' + (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 14), os: cs.outlineStyle, ow: cs.outlineWidth, w: Math.round(b.width), h: Math.round(b.height), vis: r.bottom > 0 && r.top < innerHeight, cls: e.className, node: [...document.querySelectorAll('*')].indexOf(e) }; });
        if (!s) break; if (rows.length && rows[0].node === s.node) break;
        rows.push(s);
        if (s.os === 'none' || s.ow !== '2px') bad.push(s.k + ' ' + s.os + ' ' + s.ow);
        if (w === 360 && (s.h < 44 || (s.w < 44 && !/^a:/.test(s.k)))) small.push(`${s.k} ${s.w}x${s.h}`);
      }
      const inOrder = rows.slice(1).every((r, i) => r.node > rows[i].node || true);
      console.log(`[${stage}@${w}] n=${rows.length}\n  order: ${rows.map((r) => r.k).join(' > ')}\n  ring!=2px solid: ${JSON.stringify(bad)}\n  <44 (360): ${JSON.stringify(small)}`);
      console.log('  DOM-order monotone:', rows.slice(1).every((r, i) => r.node >= rows[i].node));
    }
    await c.close();
  }
  await browser.close();
})();
