// Tiện ích dùng chung cho kiểm thử T-007 (không sửa mã sản phẩm).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101';
let n = 0;
const rand = () => `${Date.now()}${++n}`;
const results = [];
const rec = (id, ok, note) => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${note || ''}`); };

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 900 }, ...opts });
  const external = [];
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'about:') return route.continue();
    external.push(route.request().url());
    if (u.hostname === 'img.example.test') {
      // 1x1 PNG giả lập máy chủ ảnh https hợp lệ
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    }
    return route.abort();
  });
  return { ctx, external };
}

// Hàng đợi trả lời hộp thoại prompt/confirm; beforeunload ghi lại.
function dialogs(page) {
  const st = { prompts: [], confirms: [], log: [] };
  page.on('dialog', async (d) => {
    st.log.push({ type: d.type(), msg: d.message() });
    if (d.type() === 'prompt') return d.accept(st.prompts.length ? st.prompts.shift() : '');
    if (d.type() === 'confirm') return d.accept === undefined ? 0 : (st.confirms.length ? (st.confirms.shift() ? d.accept() : d.dismiss()) : d.accept());
    if (d.type() === 'beforeunload') { st.beforeunload = (st.beforeunload || 0) + 1; return st.leave === false ? d.dismiss() : d.accept(); }
    return d.dismiss(); // alert => ghi nhận bằng log
  });
  return st;
}

async function register(page, email, pw = 'matkhau-12345') {
  await page.goto(BASE + '/dang-ky');
  await page.fill('#email', email); await page.fill('#password', pw);
  await Promise.all([page.waitForURL('**/studio'), page.click('button[type=submit]')]);
}
async function setupEditor(page, d, spaceTitle = 'Tài liệu', pageTitle = 'Trang thử') {
  d.prompts.push(spaceTitle);
  await page.click('#new-space');
  await page.getByRole('button', { name: 'Mở', exact: true }).first().click();
  d.prompts.push(pageTitle, '');
  await page.click('#new-page');
  await page.getByRole('button', { name: 'Soạn', exact: true }).first().click();
  await page.waitForSelector('#ed-panel:not([hidden])');
}
async function pageId(page) { return page.evaluate(async () => { const s = (await (await fetch('/api/spaces')).json()).spaces[0]; const t = (await (await fetch('/api/spaces/' + s.id + '/tree')).json()).tree; return { sid: s.id, pid: t[0].id }; }); }
module.exports = { chromium, BASE, rand, rec, results, newCtx, dialogs, register, setupEditor, pageId };
