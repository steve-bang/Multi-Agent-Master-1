// Chụp mọi màn hình hiện có. Chạy: BASE=http://127.0.0.1:3120 OUT=<dir> node shoot-all.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE, OUT = process.env.OUT;
const log = [];
const SIZES = { d: { width: 1280, height: 800 }, m: { width: 360, height: 800 } };

(async () => {
  const browser = await chromium.launch();
  async function ctx(size) {
    const c = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 2, locale: 'vi-VN' });
    const p = await c.newPage();
    p.on('dialog', (d) => d.dismiss());
    return { c, p };
  }
  async function shot(p, name, full) {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full });
    log.push(name);
    console.log('OK', name);
  }
  const api = (p, method, url, body) =>
    p.evaluate(async ([method, url, body]) => {
      const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, j };
    }, [method, url, body]);
  const authUi = async (p, kind, email, pw) => {
    await p.goto(`${BASE}/${kind === 'register' ? 'dang-ky' : 'dang-nhap'}`);
    await p.fill('#email', email); await p.fill('#password', pw);
    await p.click('#auth-form button[type=submit]');
  };

  for (const size of ['d', 'm']) {
    const s = size;
    const { c, p } = await ctx(s);
    const email = `demo-${s}-${Date.now()}@example.vn`;

    // --- Đăng ký ---
    await p.goto(`${BASE}/dang-ky`); await shot(p, `01-dang-ky-trong-${s}`);
    await p.fill('#email', email); await p.fill('#password', 'ngan'); await p.click('#auth-form button[type=submit]');
    await p.waitForTimeout(600); await shot(p, `02-dang-ky-loi-mat-khau-ngan-${s}`);
    await p.fill('#email', 'khong-phai-email'); await p.fill('#password', 'matkhau-dai-du-8'); await p.click('#auth-form button[type=submit]');
    await p.waitForTimeout(600); await shot(p, `03-dang-ky-loi-email-sai-${s}`);

    // đăng ký thật
    await authUi(p, 'register', email, 'matkhau-dai-du-8');
    await p.waitForURL('**/studio', { timeout: 8000 }).catch(() => log.push('WARN register redirect ' + s));
    await shot(p, `04-studio-trong-chua-co-space-${s}`);

    // đăng ký trùng email (ngữ cảnh mới)
    const b = await ctx(s);
    await authUi(b.p, 'register', email, 'matkhau-dai-du-8'); await b.p.waitForTimeout(800);
    await shot(b.p, `05-dang-ky-loi-email-da-ton-tai-${s}`);

    // --- Đăng nhập ---
    await b.p.goto(`${BASE}/dang-nhap`); await shot(b.p, `06-dang-nhap-trong-${s}`);
    await b.p.fill('#email', email); await b.p.fill('#password', 'sai-mat-khau-1'); await b.p.click('#auth-form button[type=submit]');
    await b.p.waitForTimeout(700); await shot(b.p, `07-dang-nhap-loi-sai-mat-khau-${s}`);
    for (let i = 0; i < 5; i++) await api(b.p, 'POST', '/api/auth/login', { email, password: 'sai-nua-' + i });
    await b.p.fill('#email', email); await b.p.fill('#password', 'matkhau-dai-du-8'); await b.p.click('#auth-form button[type=submit]');
    await b.p.waitForTimeout(700); await shot(b.p, `08-dang-nhap-bi-khoa-${s}`);
    await b.c.close();

    // --- Chưa đăng nhập vào /studio ---
    const n = await ctx(s);
    await n.p.goto(`${BASE}/studio`); await shot(n.p, `09-chua-dang-nhap-vao-studio-bi-chuyen-ve-dang-nhap-${s}`);
    await n.p.goto(`${BASE}/khong-ton-tai`); await shot(n.p, `10-loi-404-${s}`);
    await n.c.close();

    // --- Studio có dữ liệu ---
    await p.goto(`${BASE}/studio`);
    const sp = await api(p, 'POST', '/api/spaces', { title: 'Tài liệu sản phẩm' });
    const sid = (sp.j.space || sp.j).id;
    const mk = async (title, parentId, bodyMd) => {
      const r = await api(p, 'POST', `/api/spaces/${sid}/pages`, { title, parentId: parentId || null, bodyMd });
      return (r.j.page || r.j).id;
    };
    const body1 = '# Bắt đầu nhanh\n\nChào mừng bạn đến với **tài liệu** sản phẩm. Đây là bước đầu tiên.\n\n## Cài đặt\n\n1. Tải bản mới nhất\n2. Chạy lệnh cài đặt\n\n```bash\nnpm install\nnpm start\n```\n\n| Tính năng | Trạng thái |\n|---|---|\n| Đăng nhập | Xong |\n| Soạn Markdown | Xong |\n| Xuất bản | Chưa làm |\n\n> Lưu ý: ảnh chỉ chèn bằng đường dẫn URL.\n';
    const p1 = await mk('Bắt đầu nhanh', null, body1);
    const p2 = await mk('Hướng dẫn cài đặt', p1, '## Cài đặt\n\nNội dung cài đặt.');
    await mk('Cấu hình nâng cao', p2, 'Cấu hình.');
    await mk('Câu hỏi thường gặp', null, 'Hỏi đáp.');
    await p.reload();
    await shot(p, `11-studio-danh-sach-space-${s}`, true);
    await p.getByRole('button', { name: 'Mở' }).first().click();
    await p.waitForTimeout(800);
    await shot(p, `12-studio-cay-trang-${s}`, true);
    await p.getByRole('button', { name: 'Soạn' }).first().click();
    await p.waitForTimeout(1800);
    await shot(p, `13-trinh-soan-markdown-va-xem-truoc-${s}`, true);
    await p.focus('#ed-body'); await p.keyboard.press('Control+End'); await p.keyboard.type('\n\nDòng mới chưa lưu.');
    await p.waitForTimeout(300); await shot(p, `14-trinh-soan-co-thay-doi-chua-luu-${s}`, true);
    await p.click('#ed-save'); await p.waitForTimeout(900); await shot(p, `15-trinh-soan-da-luu-${s}`, true);
    await p.click('#tb-table'); await p.waitForTimeout(300);

    // 429: bắn vượt hạn mức trần 120 request
    await p.evaluate(async () => { for (let i = 0; i < 125; i++) await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyMd: 'x' }) }); });
    await p.focus('#ed-body'); await p.keyboard.type(' thêm chữ.');
    await p.waitForTimeout(3000);
    await shot(p, `16-xem-truoc-bi-gioi-han-429-thong-bao-nhe-${s}`, true);
    { const dt = await ctx(s); await dt.p.goto(`${BASE}/design-tokens`); await shot(dt.p, `17-design-tokens-${s}`, true); await dt.c.close(); }
    await c.close();
  }
  await browser.close();
  console.log('TOTAL', log.length);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
