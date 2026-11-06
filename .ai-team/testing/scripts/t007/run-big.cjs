// T-007 retest b6e6335: dán/gõ nội dung lớn (50 KB, 200 KB) -> 429? trễ xem trước? mất ký tự? focus?
const L = require('./lib.cjs');
async function sess(browser) {
  const { ctx } = await L.newCtx(browser); const page = await ctx.newPage(); const d = L.dialogs(page);
  const S = { reqs: [], pe: [], t0: Date.now() };
  page.on('pageerror', (e) => S.pe.push(e.message));
  page.on('response', (r) => { if (r.url().endsWith('/api/preview')) S.reqs.push({ t: +((Date.now() - S.t0) / 1000).toFixed(1), s: r.status() }); });
  await L.register(page, `g${L.rand()}@example.com`); await L.setupEditor(page, d);
  await page.waitForTimeout(1500); S.reqs.length = 0; S.t0 = Date.now(); return { ctx, page, S, d };
}
const mk = (kb) => { let s = '', i = 0; while (s.length < kb * 1024) s += `Dòng ${i++} xin chào các bạn, **tài liệu** hướng dẫn [liên kết](https://example.com/${i}).\n`; return s + 'CUOI-MARK-' + kb; };
(async () => {
  const browser = await L.chromium.launch();
  for (const kb of (process.env.KBS || "50,200").split(",").map(Number)) {
    // 1) dán một lần rồi gõ tiếp 5 s
    { const { ctx, page, S } = await sess(browser); const body = mk(kb); await page.focus('#ed-body');
      const t = Date.now(); await page.evaluate((b) => { const ta = document.getElementById('ed-body'); ta.value = b; ta.dispatchEvent(new Event('input', { bubbles: true })); }, body);
      let seen = null; while (Date.now() - t < 20000) { const has = await page.evaluate((k) => document.getElementById('ed-preview').srcdoc.includes(k), 'CUOI-MARK-' + kb); if (has) { seen = Date.now() - t; break; } await page.waitForTimeout(100); }
      const typed = ' gõ thêm sau khi dán'; await page.keyboard.type(typed, { delay: 90 });
      const t2 = Date.now(); let seen2 = null; while (Date.now() - t2 < 20000) { const has = await page.evaluate(() => document.getElementById('ed-preview').srcdoc.includes('sau khi dán')); if (has) { seen2 = Date.now() - t2; break; } await page.waitForTimeout(100); }
      const v = await page.inputValue('#ed-body'); const act = await page.evaluate(() => document.activeElement.id);
      const n429 = S.reqs.filter((r) => r.s === 429).length;
      L.rec(`BIG ${kb}KB dán + gõ tiếp`, v === body + typed && act === 'ed-body' && n429 === 0 && S.pe.length === 0 && seen !== null && seen2 !== null,
        `ký tự ${v.length}/${(body + typed).length}; focus=${act}; request=${S.reqs.length} (429:${n429}); preview hiện nội dung dán sau ${seen}ms; sau gõ thêm sau ${seen2}ms; pageerror=${S.pe.length}; timeline=${S.reqs.map((r) => r.t + ':' + r.s).join(' ')}`); await ctx.close(); }
    // 2) gõ liên tục 40 s sau khi nội dung lớn có sẵn (giả lập sửa tài liệu lớn): 90ms/ký tự, nghỉ 1.2 s mỗi 10 ký tự
    { const { ctx, page, S } = await sess(browser); const body = mk(kb); await page.evaluate((b) => { const ta = document.getElementById('ed-body'); ta.value = b; ta.dispatchEvent(new Event('input', { bubbles: true })); }, body);
      await page.waitForTimeout(3000); S.reqs.length = 0; S.t0 = Date.now(); await page.focus('#ed-body'); await page.keyboard.press('Control+End'); let typed = 0, lost = 0;
      while (Date.now() - S.t0 < 40000) { await page.keyboard.type('abcdefghij', { delay: 90 }); typed += 10; await page.waitForTimeout(1200); const a = await page.evaluate(() => document.activeElement.id); if (a !== 'ed-body') lost++; }
      await page.waitForTimeout(8000); const v = await page.inputValue('#ed-body'); const n429 = S.reqs.filter((r) => r.s === 429).length;
      const note = await page.evaluate(() => { const n = document.getElementById('pv-note'); return n && !n.hidden ? n.textContent : null; });
      const hasEnd = await page.evaluate(() => document.getElementById('ed-preview').srcdoc.includes('abcdefghij'));
      L.rec(`BIG ${kb}KB sửa liên tục 40 s (gõ 10 ký tự/1.3 s)`, v.length === body.length + typed && lost === 0 && n429 === 0 && S.pe.length === 0 && hasEnd,
        `ký tự ${v.length}/${body.length + typed}; focus rời=${lost}; request=${S.reqs.length} (429:${n429}); note cuối=${note}; preview theo kịp=${hasEnd}; timeline=${S.reqs.map((r) => r.t + ':' + r.s).join(' ')}`); await ctx.close(); }
  }
  console.log('ALL', L.results.filter((r) => r.ok).length + '/' + L.results.length);
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
