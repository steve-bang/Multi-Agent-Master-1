// BUG-002 retest (SHA 9d59515): gõ như người 60 s, nhiều nhịp; ép 429. Viết lại cho debounce 800 ms / hạn mức 120 phút.
const L = require('./lib.cjs');
const words = ['xin', 'chào', 'các', 'bạn', 'đây', 'là', 'tài', 'liệu', 'hướng', 'dẫn', 'sử', 'dụng', 'hệ', 'thống'];
async function session(browser) {
  const { ctx } = await L.newCtx(browser); const page = await ctx.newPage(); const d = L.dialogs(page);
  const S = { reqs: [], t0: 0, focusLost: 0, dialogs: d, pageerrors: [] };
  page.on('pageerror', (e) => S.pageerrors.push(e.message));
  page.on('response', (r) => { if (r.url().endsWith('/api/preview')) S.reqs.push({ t: +((Date.now() - S.t0) / 1000).toFixed(1), s: r.status(), ra: r.headers()['retry-after'] }); });
  await L.register(page, `r${L.rand()}@example.com`); await L.setupEditor(page, d);
  await page.fill('#ed-body', ''); await page.waitForTimeout(1500);
  S.reqs.length = 0; S.t0 = Date.now(); await page.focus('#ed-body');
  return { ctx, page, S };
}
const snap = (page) => page.evaluate(() => ({ active: document.activeElement.id, alertVisible: !document.querySelector('[role=alert]').hidden, note: (() => { const n = document.getElementById('pv-note'); return n && !n.hidden ? n.textContent : null; })(), noteAttrs: (() => { const n = document.getElementById('pv-note'); return n ? n.getAttribute('role') + '/' + n.getAttribute('aria-live') : null; })() }));
async function checkFocus(page, S) { const s = await snap(page); if (s.active !== 'ed-body') S.focusLost++; return s; }
function report(name, S, expected, actual, extra) {
  const n429 = S.reqs.filter((r) => r.s === 429).length;
  const ok = actual === expected && S.focusLost === 0 && n429 === 0 && !S.dialogs.log.some((x) => x.type === 'alert') && S.pageerrors.length === 0;
  L.rec(name, ok, `request /api/preview=${S.reqs.length} (200:${S.reqs.filter((r) => r.s === 200).length}, 429:${n429}); ký tự kỳ vọng=${expected} thực=${actual} mất=${expected - actual}; lần focus rời textarea=${S.focusLost}; alert dialog=${S.dialogs.log.filter((x) => x.type === 'alert').length}; pageerror=${S.pageerrors.length} ${extra || ''}`);
}
(async () => {
  const browser = await L.chromium.launch();
  // A: 90 ms/ký tự, dừng 450 ms giữa từ, 60 s
  { const { ctx, page, S } = await session(browser); let typed = 0, i = 0;
    while (Date.now() - S.t0 < 60000) { const w = words[i++ % words.length] + ' '; await page.keyboard.type(w, { delay: 90 }); typed += w.length; await page.waitForTimeout(450); await checkFocus(page, S); }
    await page.waitForTimeout(1500); const val = await page.inputValue('#ed-body');
    const last = val.trim().split(' ').pop(); const pv = await page.evaluate(() => document.getElementById('ed-preview').srcdoc);
    report('BUG-002 A: 90ms/ký tự, dừng 450ms giữa từ, 60 s', S, typed, val.length, `; preview theo kịp từ cuối "${last}"=${pv.includes(last)}; timeline=${S.reqs.map((r) => r.t + ':' + r.s).join(' ')}`); await ctx.close(); }
  // B: dừng 900 ms giữa từ (> debounce)
  { const { ctx, page, S } = await session(browser); let typed = 0, i = 0;
    while (Date.now() - S.t0 < 60000) { const w = words[i++ % words.length] + ' '; await page.keyboard.type(w, { delay: 90 }); typed += w.length; await page.waitForTimeout(900); await checkFocus(page, S); }
    await page.waitForTimeout(1500); const val = await page.inputValue('#ed-body'); const last = val.trim().split(' ').pop(); const pv = await page.evaluate(() => document.getElementById('ed-preview').srcdoc);
    report('BUG-002 B: 90ms/ký tự, dừng 900ms giữa từ (>debounce), 60 s', S, typed, val.length, `; preview chứa từ cuối=${pv.includes(last)}`); await ctx.close(); }
  // C: gõ - xóa - gõ
  { const { ctx, page, S } = await session(browser); let exp = ''; const t0 = Date.now(); let k = 0;
    while (Date.now() - t0 < 60000) { const w = words[k++ % words.length] + ' ' + words[k % words.length] + ' ';
      await page.keyboard.type(w, { delay: 110 }); exp += w; await page.waitForTimeout(300);
      await page.keyboard.press('Backspace', { delay: 60 }); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); exp = exp.slice(0, -3);
      await page.waitForTimeout(k % 3 === 0 ? 1000 : 200); await checkFocus(page, S); }
    await page.waitForTimeout(1500); const val = await page.inputValue('#ed-body');
    L.rec('BUG-002 C: gõ-xóa-gõ 60 s: nội dung textarea đúng kỳ vọng', val === exp, `len=${val.length}/${exp.length}`);
    report('BUG-002 C: số liệu', S, exp.length, val.length); await ctx.close(); }
  // D: ép 429 bằng >120 request cùng cookie rồi gõ tiếp
  { const { ctx, page, S } = await session(browser); S.reqs.length = 0;
    const burst = await page.evaluate(async () => { const c = {}; for (let i = 0; i < 125; i++) { const r = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: 'x' }) }); c[r.status] = (c[r.status] || 0) + 1; } return c; });
    L.rec('BUG-002 D0: bắn 125 request đạt hạn mức 120/phút', burst[200] === 120 && burst[429] === 5, JSON.stringify(burst));
    S.reqs.length = 0; S.t0 = Date.now(); S.dialogs.log.length = 0;
    await page.focus('#ed-body'); let typed = 0, noteSeen = null, alertSeen = false, retryAfter = null; const words2 = ['phục', 'hồi', 'sau', 'khi', 'bị', 'giới', 'hạn'];
    for (let i = 0; i < words2.length; i++) { const w = words2[i] + ' '; await page.keyboard.type(w, { delay: 90 }); typed += w.length; await page.waitForTimeout(1000);
      const s = await checkFocus(page, S); if (s.note && noteSeen === null) noteSeen = { t: +((Date.now() - S.t0) / 1000).toFixed(1), text: s.note, attrs: s.noteAttrs }; if (s.alertVisible) alertSeen = true; }
    const typedAfter = await page.inputValue('#ed-body');
    L.rec('BUG-002 D1: khi bị 429, ký tự gõ tiếp không mất, focus giữ ở textarea', typedAfter.length === typed && S.focusLost === 0, `gõ ${typed} có ${typedAfter.length}; focus rời=${S.focusLost}`);
    L.rec('BUG-002 D2: có thông báo nhẹ (role=status aria-live=polite), KHÔNG alert dialog, KHÔNG hiện [role=alert]', !!noteSeen && noteSeen.attrs === 'status/polite' && !alertSeen && !S.dialogs.log.some((x) => x.type === 'alert'), JSON.stringify(noteSeen) + ' alertVisible=' + alertSeen);
    const r429 = S.reqs.filter((r) => r.s === 429); retryAfter = r429.length ? r429[0].ra : null;
    console.log('   timeline trong D:', S.reqs.map((r) => r.t + ':' + r.s + (r.ra ? '(ra' + r.ra + ')' : '')).join(' '));
    // chờ hồi phục theo Retry-After (tối đa 90 s), vẫn giữ focus
    const tw = Date.now(); let recovered = false; const want = typedAfter.trim().split(' ').pop();
    while (Date.now() - tw < 90000) { await page.waitForTimeout(1000); const s = await snap(page); const pv = await page.evaluate(() => document.getElementById('ed-preview').srcdoc); if (!s.note && pv.includes(want)) { recovered = true; break; } }
    const fin = await snap(page);
    L.rec('BUG-002 D3: tự phục hồi sau Retry-After: thông báo biến mất, preview cập nhật nội dung mới, không cần thao tác', recovered && fin.active === 'ed-body', `Retry-After=${retryAfter}; chờ ${Math.round((Date.now() - tw) / 1000)}s; recovered=${recovered}; focus=${fin.active}; timeline=${S.reqs.slice(-6).map((r) => r.t + ':' + r.s).join(' ')}`);
    L.rec('BUG-002 D4: không pageerror', S.pageerrors.length === 0, JSON.stringify(S.pageerrors)); await ctx.close(); }
  console.log('ALL', L.results.filter((r) => r.ok).length + '/' + L.results.length, 'FAILS:', L.results.filter((r) => !r.ok).map((r) => r.id).join(' ; '));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
