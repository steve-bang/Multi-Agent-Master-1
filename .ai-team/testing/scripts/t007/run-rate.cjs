const L = require('./lib.cjs');
(async () => {
  const browser = await L.chromium.launch();
  const { ctx } = await L.newCtx(browser);
  const page = await ctx.newPage(); const d = L.dialogs(page);
  const reqs = []; const t0 = { v: 0 };
  page.on('response', (r) => { if (r.url().endsWith('/api/preview')) reqs.push({ t: Math.round((Date.now() - t0.v) / 1000), s: r.status() }); });
  await L.register(page, `r${L.rand()}@example.com`); await L.setupEditor(page, d);
  await page.fill('#ed-body', ''); await page.waitForTimeout(600);
  reqs.length = 0; t0.v = Date.now();
  await page.focus('#ed-body');
  const words = ['xin', 'chào', 'các', 'bạn', 'đây', 'là', 'tài', 'liệu', 'hướng', 'dẫn', 'sử', 'dụng', 'hệ', 'thống'];
  let typed = 0, i = 0, firstAlertAt = null, focusLost = null;
  while (Date.now() - t0.v < 60000) {
    const w = words[i++ % words.length] + ' ';
    await page.keyboard.type(w, { delay: 90 }); typed += w.length;
    await page.waitForTimeout(450); // dừng nghĩ giữa các từ (> debounce 300 ms)
    if (firstAlertAt === null && (await page.evaluate(() => !document.querySelector('[role=alert]').hidden))) { firstAlertAt = Math.round((Date.now() - t0.v) / 1000); }
  }
  await page.waitForTimeout(800);
  const actual = (await page.inputValue('#ed-body')).length;
  const alertTx = await page.evaluate(() => { const a = document.querySelector('[role=alert]'); return a.hidden ? null : a.textContent; });
  const active = await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('role') || document.activeElement.tagName);
  const n429 = reqs.filter((r) => r.s === 429).length;
  console.log('A) gõ kiểu người (từ 90ms/ký tự + dừng 450ms) 60 s: tổng request /api/preview =', reqs.length, '200:', reqs.filter((r) => r.s === 200).length, '429:', n429);
  console.log('   request đầu bị 429 ở giây ~', (reqs.find((r) => r.s === 429) || {}).t, '; alert hiện lần đầu giây ~', firstAlertAt);
  console.log('   thông báo người dùng thấy cuối cùng:', JSON.stringify(alertTx));
  console.log('   ký tự đã gõ', typed, 'ký tự có trong textarea', actual, '=> mất', typed - actual, '; phần tử đang focus cuối:', active);
  const cnt = {}; reqs.forEach((r) => { const k = r.t + ':' + r.s; cnt[k] = 1; }); console.log('   timeline(giây:status):', reqs.map((r) => r.t + ':' + r.s).join(' '));
  // preview còn cập nhật sau lỗi?
  const lastHtml = await page.evaluate(() => document.getElementById('ed-preview').srcdoc.slice(-80));
  console.log('   srcdoc cuối (preview có kịp nội dung mới?):', JSON.stringify(lastHtml));
  const ta = await page.inputValue('#ed-body'); const lastWord = ta.trim().split(' ').pop();
  console.log('   từ cuối trong textarea:', lastWord, '; preview chứa từ đó:', lastHtml.includes(lastWord));
  // B) gõ liên tục không dừng 20 s
  const r2 = await L.newCtx(browser); const p2 = await r2.ctx.newPage(); const d2 = L.dialogs(p2); const q2 = [];
  p2.on('response', (r) => { if (r.url().endsWith('/api/preview')) q2.push(r.status()); });
  await L.register(p2, `r${L.rand()}@example.com`); await L.setupEditor(p2, d2); await p2.fill('#ed-body', ''); await p2.waitForTimeout(500); q2.length = 0;
  await p2.focus('#ed-body'); const t1 = Date.now(); while (Date.now() - t1 < 20000) await p2.keyboard.type('gõ liên tục không dừng ', { delay: 120 });
  await p2.waitForTimeout(600);
  console.log('B) gõ liên tục 20 s (120ms/ký tự, không dừng): request preview =', q2.length, 'trạng thái', JSON.stringify(q2));
  // C) mất focus sau 429: gõ ngay sau khi chạm 429
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
