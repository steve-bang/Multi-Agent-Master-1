// T-007 retest b6e6335: closeEd hủy timer/request/thông báo; đếm request /api/preview SAU khi đóng (kỳ vọng 0).
const L = require('./lib.cjs');
async function sess(browser, route) {
  const { ctx } = await L.newCtx(browser); const page = await ctx.newPage(); const d = L.dialogs(page);
  const S = { starts: [], pe: [], tClose: null, resp: [] };
  page.on('pageerror', (e) => S.pe.push(e.message));
  page.on('request', (r) => { if (r.url().endsWith('/api/preview')) S.starts.push({ t: Date.now(), body: (r.postData() || '').slice(0, 60) }); });
  page.on('response', (r) => { if (r.url().endsWith('/api/preview')) S.resp.push(r.status()); });
  await L.register(page, `c${L.rand()}@example.com`); await L.setupEditor(page, d);
  await page.waitForTimeout(1500);
  if (route) await route(page);
  S.starts.length = 0; S.resp.length = 0; return { ctx, page, S, d };
}
const after = (S) => S.starts.filter((r) => r.t > S.tClose).length;
const note = (page) => page.evaluate(() => { const n = document.getElementById('pv-note'); return n && !n.hidden ? n.textContent : null; });
(async () => {
  const browser = await L.chromium.launch();
  // 1) đóng khi đang chờ debounce
  { const { ctx, page, S } = await sess(browser); await page.focus('#ed-body'); await page.keyboard.type('xin chào', { delay: 50 }); await page.waitForTimeout(200);
    S.tClose = Date.now(); await page.click('#ed-close'); await page.waitForTimeout(5000);
    const hidden = await page.evaluate(() => document.getElementById('ed-panel').hidden);
    L.rec('CLOSE-1 đóng khi chờ debounce', hidden && after(S) === 0 && S.pe.length === 0, `panel ẩn=${hidden}; request sau đóng=${after(S)}; tổng=${S.starts.length}; pageerror=${S.pe.length}`); await ctx.close(); }
  // 2) đóng khi đang chờ thử lại 429
  { const { ctx, page, S } = await sess(browser);
    await page.evaluate(async () => { for (let i = 0; i < 125; i++) { const r = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: 'x' }) }); await r.text(); } });
    S.starts.length = 0; await page.focus('#ed-body'); await page.keyboard.type('thu lai', { delay: 50 });
    let n = null; for (let i = 0; i < 40 && !n; i++) { await page.waitForTimeout(250); n = await note(page); }
    const st429 = S.resp.filter((s) => s === 429).length;
    S.tClose = Date.now(); await page.click('#ed-close'); const nAfter = await note(page);
    await page.waitForTimeout(75000);
    L.rec('CLOSE-2 đóng khi đang chờ thử lại 429', !!n && st429 >= 1 && nAfter === null && after(S) === 0 && S.pe.length === 0, `note trước đóng=${n}; 429 nhận=${st429}; note sau đóng=${nAfter}; request sau đóng trong 75 s (qua Retry-After 60 s)=${after(S)}; pageerror=${S.pe.length}`); await ctx.close(); }
  // 3) đóng khi request đang bay (trễ 3 s)
  { const { ctx, page, S } = await sess(browser, (p) => p.route('**/api/preview', async (r) => { await new Promise((x) => setTimeout(x, 3000)); try { await r.continue(); } catch (e) {} }));
    await page.focus('#ed-body'); await page.keyboard.type('dang bay', { delay: 50 });
    let k = 0; while (!S.starts.length && k++ < 40) await page.waitForTimeout(100);
    const inflight = S.starts.length; await page.waitForTimeout(300); S.tClose = Date.now(); await page.click('#ed-close'); await page.waitForTimeout(8000);
    const hidden = await page.evaluate(() => document.getElementById('ed-panel').hidden); const nt = await note(page);
    L.rec('CLOSE-3 đóng khi request đang bay', inflight === 1 && hidden && after(S) === 0 && nt === null && S.pe.length === 0, `request bay trước đóng=${inflight}; request sau đóng=${after(S)}; panel ẩn=${hidden}; note=${nt}; pageerror=${S.pe.length}`); await ctx.close(); }
  // 4) chuyển sang trang khác (điều hướng đầy đủ) khi chờ debounce
  { const { ctx, page, S } = await sess(browser); await page.focus('#ed-body'); await page.keyboard.type('roi di', { delay: 50 }); S.tClose = Date.now();
    await page.goto(L.BASE + '/dang-nhap'); await page.waitForTimeout(4000);
    L.rec('CLOSE-4 điều hướng đi nơi khác khi chờ debounce', after(S) === 0 && S.pe.length === 0, `request sau điều hướng=${after(S)}; pageerror=${S.pe.length}; hộp thoại=${JSON.stringify(S.d || '')}`); await ctx.close(); }
  // 5) chuyển sang soạn trang KHÁC trong studio khi chờ debounce: không được gửi nội dung cũ
  { const { ctx, page, S, d } = await sess(browser);
    try {
      await page.click('#ed-close'); d.prompts.push('Trang hai', ''); await page.click('#new-page');
      const btns = page.getByRole('button', { name: 'Soạn', exact: true }); await btns.first().waitFor(); const cnt = await btns.count();
      await btns.nth(0).click(); await page.waitForSelector('#ed-panel:not([hidden])'); await page.waitForTimeout(1500); S.starts.length = 0;
      await page.focus('#ed-body'); await page.keyboard.type('NOIDUNG-CU', { delay: 50 }); S.tClose = Date.now();
      await page.click('#ed-close'); await btns.nth(cnt - 1).click(); await page.waitForSelector('#ed-panel:not([hidden])'); await page.waitForTimeout(5000);
      const stale = S.starts.filter((r) => r.body.includes('NOIDUNG-CU')).length;
      L.rec('CLOSE-5 đóng rồi mở trang khác ngay khi chờ debounce', stale === 0 && S.pe.length === 0, `nút Soạn=${cnt}; request chứa nội dung cũ=${stale}; request sau đóng (của trang mới, kỳ vọng ≤1)=${after(S)}; pageerror=${S.pe.length}`);
    } catch (e) { console.log('KHÔNG CHẠY ĐƯỢC CLOSE-5:', e.message.split('\n')[0]); } await ctx.close(); }
  console.log('ALL', L.results.filter((r) => r.ok).length + '/' + L.results.length);
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
