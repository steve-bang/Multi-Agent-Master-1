// BUG-001 retest: xóa trang lá và trang có con trên UI thật; kiểm tra header DELETE.
const L = require('./lib.cjs');
(async () => {
  const browser = await L.chromium.launch(); const { ctx } = await L.newCtx(browser); const page = await ctx.newPage(); const d = L.dialogs(page);
  const dels = []; page.on('request', (r) => { if (r.method() === 'DELETE') dels.push({ url: r.url().replace(L.BASE, ''), ct: r.headers()['content-type'] || null, body: r.postData() }); });
  const resp = []; page.on('response', (r) => { if (r.request().method() === 'DELETE') resp.push(r.status()); });
  await L.register(page, `d${L.rand()}@example.com`);
  d.prompts.push('Không gian'); await page.click('#new-space'); await page.getByRole('button', { name: 'Mở', exact: true }).first().click();
  const mk = async (title, parentBtnIdx) => { d.prompts.push(title, ''); if (parentBtnIdx == null) await page.click('#new-page'); else await page.getByRole('button', { name: 'Thêm trang con' }).nth(parentBtnIdx).click(); await page.waitForTimeout(400); };
  await mk('Gốc A'); await mk('Gốc B'); await mk('Con A1', 0); await mk('Con A2', 0);
  const tree = () => page.textContent('#tree'); const alerts = () => d.log.filter((x) => x.type === 'alert').length;
  console.log('cây ban đầu:', (await tree()).replace(/Soạn|Thêm trang con|Đổi tên|Xóa|Lùi ra/g, ' ').replace(/\s+/g, ' '));
  const vis = () => page.evaluate(() => { const a = document.querySelector('[role=alert]'); return a.hidden ? '' : a.textContent; });
  // hủy confirm: không xóa
  d.log.length = 0; d.confirms.push(false); await page.getByRole('button', { name: 'Xóa', exact: true }).last().click(); await page.waitForTimeout(500);
  L.rec('1a hủy confirm: không gọi DELETE, trang còn', dels.length === 0 && /Gốc B/.test(await tree()), 'confirm=' + JSON.stringify(d.log.map((x) => x.type)));
  // xóa trang lá: Con A2
  const rows = await page.locator('#tree li').allTextContents(); console.log('rows', rows.length);
  const leaf = page.locator('#tree li', { hasText: 'Con A2' }).last();
  d.log.length = 0; d.confirms.push(true); await leaf.getByRole('button', { name: 'Xóa', exact: true }).first().click(); await page.waitForTimeout(600);
  let t = await tree();
  L.rec('1b xóa trang LÁ (Con A2) trên UI: DELETE 204, trang biến mất, trang khác còn, không alert, không thông báo lỗi', resp[0] === 204 && !/Con A2/.test(t) && /Con A1/.test(t) && /Gốc B/.test(t) && alerts() === 0 && (await vis()) === '', `status=${resp} req=${JSON.stringify(dels[0])} alertDialog=${alerts()} msg="${await vis()}"`);
  L.rec('1c header DELETE: không có Content-Type/body (hook bỏ khi body rỗng)', dels[0] && dels[0].ct === null && !dels[0].body, JSON.stringify(dels[0]));
  // xóa trang có con: Gốc A (còn Con A1)
  d.log.length = 0; d.confirms.push(true); await page.locator('#tree > ul > li, #tree li').filter({ hasText: 'Gốc A' }).first().getByRole('button', { name: 'Xóa', exact: true }).first().click(); await page.waitForTimeout(600);
  t = await tree(); const cf = d.log.find((x) => x.type === 'confirm');
  L.rec('1d xóa trang CÓ CON (Gốc A): confirm nêu số con, DELETE 204, cả cây con biến mất, Gốc B còn, không alert', /1 trang con/.test(cf ? cf.msg : '') && resp[1] === 204 && !/Gốc A|Con A1/.test(t) && /Gốc B/.test(t) && alerts() === 0, `confirm=${cf && cf.msg} status=${resp} alertDialog=${alerts()} cây=${t.replace(/Soạn|Thêm trang con|Đổi tên|Xóa|Lùi ra/g, ' ').replace(/\s+/g, ' ')}`);
  // reload: server thực sự đã xóa
  await page.reload(); await page.getByRole('button', { name: 'Mở', exact: true }).first().click(); await page.waitForTimeout(400); t = await tree();
  L.rec('1e tải lại: dữ liệu server khớp (Gốc A, Con A1, Con A2 không còn; Gốc B còn)', !/Gốc A|Con A/.test(t) && /Gốc B/.test(t), t.replace(/\s+/g, ' ').slice(0, 80));
  // xóa nốt trang cuối -> cây rỗng
  d.confirms.push(true); await page.getByRole('button', { name: 'Xóa', exact: true }).first().click(); await page.waitForTimeout(500);
  L.rec('1f xóa trang cuối: cây rỗng, không alert', /Chưa có trang/.test(await tree()) && alerts() === 0, (await tree()).slice(0, 60));
  console.log('ALL', L.results.filter((r) => r.ok).length + '/' + L.results.length, 'FAILS:', L.results.filter((r) => !r.ok).map((r) => r.id).join(' ; '));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
