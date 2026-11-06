const L = require('./lib.cjs');
const OUT = '/home/user/Multi-Agent-Master-1/.ai-team/testing/test-results';
(async () => {
  const browser = await L.chromium.launch(); const { ctx } = await L.newCtx(browser); const page = await ctx.newPage(); const d = L.dialogs(page);
  await L.register(page, `s${L.rand()}@example.com`); await L.setupEditor(page, d, 'Tài liệu', 'Hướng dẫn nhanh');
  const md = '# Hướng dẫn nhanh\n\nXin chào **bạn** 😀, đây là *tài liệu* tiếng Việt.\n\n| Cột 1 | Cột 2 |\n|---|---|\n| a | b |\n\n```js\nconst x = 1;\n```\n\n![mô tả](https://img.example.test/a.png)\n\n- m1\n- m2';
  for (const [w, h, n] of [[1280, 900, '1280'], [360, 800, '360']]) {
    await page.setViewportSize({ width: w, height: h });
    const r = page.waitForResponse((x) => x.url().endsWith('/api/preview')); await page.fill('#ed-body', md + ' '.repeat(w === 360 ? 1 : 0)); await r; await page.waitForTimeout(500);
    await page.focus('#tb-table');
    await page.screenshot({ path: `${OUT}/T-007-a0f30e0-editor-${n}.png`, fullPage: true });
  }
  await browser.close();
})();
