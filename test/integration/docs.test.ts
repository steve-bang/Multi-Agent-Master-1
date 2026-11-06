import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { buildApp } from '../../src/server/app.js';
import { slugify } from '../../src/services/docs.js';

const H = { host: 'localhost:3000', origin: 'http://localhost:3000' };
type App = ReturnType<typeof buildApp>;

async function user(app: App, email: string): Promise<Record<string, string>> {
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'matkhau123' },
    headers: H,
  });
  return { ...H, cookie: String(r.headers['set-cookie']).split(';')[0] };
}
const setup = async () => {
  const app = buildApp(openDb(':memory:'));
  const a = await user(app, 'a@x.vn');
  const b = await user(app, 'b@x.vn');
  const call = (h: Record<string, string>, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: h, ...(payload ? { payload } : {}) });
  const space = async (h: Record<string, string>, title = 'Tài liệu') =>
    (await call(h, 'POST', '/api/spaces', { title })).json().space as { id: number; slug: string };
  const page = async (h: Record<string, string>, sid: number, title: string, parentId?: number) =>
    (await call(h, 'POST', `/api/spaces/${sid}/pages`, { title, parentId })).json().page as {
      id: number;
      slug: string;
    };
  return { app, a, b, call, space, page };
};

describe('REQ-007 slug', () => {
  it('REQ-007 bỏ dấu tiếng Việt, đ->d, chữ thường, gạch ngang', () => {
    expect(slugify('Đường dẫn')).toBe('duong-dan');
    expect(slugify('Hướng dẫn cài đặt')).toBe('huong-dan-cai-dat');
    expect(slugify('  Xin   chào, Thế giới!  ')).toBe('xin-chao-the-gioi');
    expect(slugify('!!!')).toBe('');
  });

  it('REQ-007 tạo trang "Hướng dẫn cài đặt" ra slug đúng và hiển thị đúng dấu; trùng thì -2, -3', async () => {
    const { a, call, space } = await setup();
    const s = await space(a);
    const r1 = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'Hướng dẫn cài đặt' });
    expect(r1.json().page.slug).toBe('huong-dan-cai-dat');
    expect(r1.json().page.title).toBe('Hướng dẫn cài đặt');
    const r2 = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'Huong dan cai dat' });
    const r3 = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'HƯỚNG DẪN CÀI ĐẶT' });
    expect(r2.json().page.slug).toBe('huong-dan-cai-dat-2');
    expect(r3.json().page.slug).toBe('huong-dan-cai-dat-3');
  });

  it('REQ-007 slug trùng giữa hai space khác nhau được phép; slug space trùng toàn cục tự thêm hậu tố', async () => {
    const { a, b, space, page } = await setup();
    const s1 = await space(a, 'Đường dẫn');
    const s2 = await space(b, 'Đường dẫn');
    expect(s1.slug).toBe('duong-dan');
    expect(s2.slug).toBe('duong-dan-2');
    expect((await page(a, s1.id, 'Mở đầu')).slug).toBe('mo-dau');
    expect((await page(b, s2.id, 'Mở đầu')).slug).toBe('mo-dau');
  });

  it('REQ-007 cho sửa slug khi tạo; slug sai bị từ chối; đổi tiêu đề KHÔNG đổi slug', async () => {
    const { a, call, space } = await setup();
    const s = await space(a);
    const ok = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'Giới thiệu', slug: 'gioi-thieu-chung' });
    expect(ok.json().page.slug).toBe('gioi-thieu-chung');
    for (const slug of ['Có Dấu', 'a--b', '-a', 'a/b', 'x'.repeat(81), 5]) {
      const bad = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'T', slug });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().error.code).toBe('SLUG_INVALID');
    }
    const ren = await call(a, 'PATCH', `/api/pages/${ok.json().page.id}`, { title: 'Tiêu đề mới' });
    expect(ren.json().page.title).toBe('Tiêu đề mới');
    expect(ren.json().page.slug).toBe('gioi-thieu-chung');
  });
});

describe('REQ-004 space và trang', () => {
  it('REQ-004 tạo space và trang, trang hiện trong cây; đổi tên space; tiêu đề rỗng/quá dài bị từ chối', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a, 'Sổ tay');
    const p = await page(a, s.id, 'Chương 1');
    const c = await page(a, s.id, 'Mục 1.1', p.id);
    const tree = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).json().tree;
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Chương 1');
    expect(tree[0].children[0].id).toBe(c.id);
    const ren = await call(a, 'PATCH', `/api/spaces/${s.id}`, { title: 'Sổ tay mới' });
    expect(ren.json().space.title).toBe('Sổ tay mới');
    expect(ren.json().space.slug).toBe(s.slug);
    expect((await call(a, 'GET', '/api/spaces')).json().spaces).toHaveLength(1);
    for (const title of ['', '   ', undefined, 5, 'x'.repeat(201)]) {
      expect((await call(a, 'POST', '/api/spaces', { title } as object)).statusCode).toBe(400);
      expect((await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title } as object)).statusCode).toBe(400);
    }
  });

  it('REQ-004 độ sâu 5 bị từ chối khi tạo (TOO_DEEP), độ sâu 4 được', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a);
    let parent: number | undefined;
    for (let i = 1; i <= 4; i++) parent = (await page(a, s.id, `Cấp ${i}`, parent)).id;
    const r = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'Cấp 5', parentId: parent });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('TOO_DEEP');
  });

  it('REQ-004 di chuyển làm cây vượt 4 cấp bị từ chối (tính cả chiều cao cây con)', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a);
    const x = await page(a, s.id, 'X');
    const x2 = await page(a, s.id, 'X2', x.id); // cây con cao 2
    const l1 = await page(a, s.id, 'L1');
    const l2 = await page(a, s.id, 'L2', l1.id);
    const l3 = await page(a, s.id, 'L3', l2.id);
    const r = await call(a, 'POST', `/api/pages/${x.id}/move`, { parentId: l3.id, position: 0 });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('TOO_DEEP');
    const ok = await call(a, 'POST', `/api/pages/${x2.id}/move`, { parentId: l3.id, position: 0 });
    expect(ok.statusCode).toBe(200);
  });

  it('REQ-004 di chuyển tạo vòng bị từ chối (chính nó và hậu duệ), cây không đổi', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a);
    const p = await page(a, s.id, 'P');
    const c = await page(a, s.id, 'C', p.id);
    const g = await page(a, s.id, 'G', c.id);
    const before = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).body;
    for (const target of [p.id, c.id, g.id]) {
      const r = await call(a, 'POST', `/api/pages/${p.id}/move`, { parentId: target, position: 0 });
      expect(r.statusCode).toBe(400);
      expect(r.json().error.code).toBe('CYCLE');
    }
    expect((await call(a, 'GET', `/api/spaces/${s.id}/tree`)).body).toBe(before);
  });

  it('REQ-004 sắp xếp: lên/xuống/thụt lề/lùi ra giữ position liên tục', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a);
    const p1 = await page(a, s.id, 'A');
    const p2 = await page(a, s.id, 'B');
    const p3 = await page(a, s.id, 'C');
    await call(a, 'POST', `/api/pages/${p3.id}/move`, { parentId: null, position: 0 }); // lên đầu
    let tree = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).json().tree;
    expect(tree.map((n: { title: string }) => n.title)).toEqual(['C', 'A', 'B']);
    await call(a, 'POST', `/api/pages/${p2.id}/move`, { parentId: p1.id, position: 0 }); // thụt lề
    tree = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).json().tree;
    expect(tree.map((n: { title: string; position: number }) => [n.title, n.position])).toEqual([
      ['C', 0],
      ['A', 1],
    ]);
    expect(tree[1].children[0].title).toBe('B');
    await call(a, 'POST', `/api/pages/${p2.id}/move`, { parentId: null, position: 99 }); // lùi ra, cuối
    tree = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).json().tree;
    expect(tree.map((n: { title: string; position: number }) => [n.title, n.position])).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ]);
    expect(tree[1].children).toHaveLength(0);
  });

  it('REQ-004 input di chuyển sai bị từ chối 400', async () => {
    const { a, call, space, page } = await setup();
    const s = await space(a);
    const p = await page(a, s.id, 'P');
    for (const payload of [{ parentId: 'x', position: 0 }, { parentId: null, position: -1 }, { parentId: null }, { parentId: 0, position: 0 }]) {
      expect((await call(a, 'POST', `/api/pages/${p.id}/move`, payload)).statusCode).toBe(400);
    }
  });

  it('REQ-004 xóa trang có con cần confirm=1 (trả childCount), xóa cascade cả cây và dồn vị trí', async () => {
    const { a, app, call, space, page } = await setup();
    const s = await space(a);
    const p = await page(a, s.id, 'P');
    const c = await page(a, s.id, 'C', p.id);
    await page(a, s.id, 'G', c.id);
    const other = await page(a, s.id, 'Q');
    const noConfirm = await call(a, 'DELETE', `/api/pages/${p.id}`);
    expect(noConfirm.statusCode).toBe(400);
    expect(noConfirm.json().error.code).toBe('CONFIRM_REQUIRED');
    expect(noConfirm.json().error.childCount).toBe(2);
    expect((await call(a, 'DELETE', `/api/pages/${p.id}?confirm=0`)).statusCode).toBe(400);
    const count = () => (app.db.prepare('SELECT COUNT(*) c FROM pages').get() as { c: number }).c;
    expect(count()).toBe(4);
    expect((await call(a, 'DELETE', `/api/pages/${p.id}?confirm=1`)).statusCode).toBe(204);
    expect(count()).toBe(1);
    expect((await call(a, 'GET', `/api/pages/${c.id}`)).statusCode).toBe(404);
    const tree = (await call(a, 'GET', `/api/spaces/${s.id}/tree`)).json().tree;
    expect(tree).toEqual([expect.objectContaining({ id: other.id, position: 0 })]);
    // trang lá xóa không cần confirm
    expect((await call(a, 'DELETE', `/api/pages/${other.id}`)).statusCode).toBe(204);
  });

  it('REQ-004 giới hạn 500 trang mỗi space', async () => {
    const { a, app, call, space } = await setup();
    const s = await space(a);
    const ins = app.db.prepare('INSERT INTO pages (space_id,title,slug,position) VALUES (?,?,?,?)');
    for (let i = 0; i < 500; i++) ins.run(s.id, `T${i}`, `t${i}`, i);
    const r = await call(a, 'POST', `/api/spaces/${s.id}/pages`, { title: 'Dư' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('TOO_MANY_PAGES');
  });
});

describe('REQ-004 phân quyền và bảo vệ', () => {
  it('REQ-004 IDOR: mọi route với space/trang của người khác trả 404 và không đổi dữ liệu', async () => {
    const { app, a, b, call, space, page } = await setup();
    const s = await space(a, 'Của A');
    const p = await page(a, s.id, 'Trang A');
    const c = await page(a, s.id, 'Con A', p.id);
    const bs = await space(b, 'Của B');
    const bp = await page(b, bs.id, 'Trang B');
    const snap = () => JSON.stringify(app.db.prepare('SELECT * FROM pages ORDER BY id').all()) + JSON.stringify(app.db.prepare('SELECT * FROM spaces ORDER BY id').all());
    const before = snap();
    const cases: [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, object?][] = [
      ['tree', 'GET', `/api/spaces/${s.id}/tree`],
      ['rename space', 'PATCH', `/api/spaces/${s.id}`, { title: 'Hack' }],
      ['create page', 'POST', `/api/spaces/${s.id}/pages`, { title: 'Hack' }],
      ['create child under foreign parent', 'POST', `/api/spaces/${bs.id}/pages`, { title: 'Hack', parentId: p.id }],
      ['get page', 'GET', `/api/pages/${p.id}`],
      ['rename page', 'PATCH', `/api/pages/${p.id}`, { title: 'Hack' }],
      ['move page', 'POST', `/api/pages/${c.id}/move`, { parentId: null, position: 0 }],
      ['move own page under foreign parent', 'POST', `/api/pages/${bp.id}/move`, { parentId: p.id, position: 0 }],
      ['delete page', 'DELETE', `/api/pages/${p.id}?confirm=1`],
    ];
    for (const [name, m, url, payload] of cases) {
      const r = await call(b, m, url, payload);
      expect(r.statusCode, name).toBe(404);
      expect(r.json().error.code, name).toBe('NOT_FOUND');
    }
    expect(snap()).toBe(before);
    expect((await call(b, 'GET', '/api/spaces')).json().spaces.map((x: { id: number }) => x.id)).toEqual([bs.id]);
    // id không tồn tại / không hợp lệ cũng 404 (không phân biệt được với của người khác)
    expect((await call(a, 'GET', '/api/pages/99999')).statusCode).toBe(404);
    expect((await call(a, 'GET', '/api/pages/abc')).statusCode).toBe(404);
  });

  it('REQ-004 chưa đăng nhập: mọi route API trả 401', async () => {
    const { app, a, space, page } = await setup();
    const s = await space(a);
    const p = await page(a, s.id, 'P');
    const cases: [string, string, object?][] = [
      ['GET', '/api/spaces'],
      ['POST', '/api/spaces', { title: 'x' }],
      ['PATCH', `/api/spaces/${s.id}`, { title: 'x' }],
      ['GET', `/api/spaces/${s.id}/tree`],
      ['POST', `/api/spaces/${s.id}/pages`, { title: 'x' }],
      ['GET', `/api/pages/${p.id}`],
      ['PATCH', `/api/pages/${p.id}`, { title: 'x' }],
      ['POST', `/api/pages/${p.id}/move`, { parentId: null, position: 0 }],
      ['DELETE', `/api/pages/${p.id}?confirm=1`],
    ];
    for (const [m, url, payload] of cases) {
      const r = await app.inject({ method: m as 'GET', url, headers: H, ...(payload ? { payload } : {}) });
      expect(r.statusCode, `${m} ${url}`).toBe(401);
    }
    expect((await app.inject({ method: 'GET', url: '/studio', headers: H })).statusCode).toBe(302);
  });

  it('REQ-004 Origin sai hoặc thiếu: mọi route ghi trả 403 và không đổi dữ liệu', async () => {
    const { app, a, space, page } = await setup();
    const s = await space(a);
    const p = await page(a, s.id, 'P');
    const cookie = a.cookie;
    const cases: [string, string, object?][] = [
      ['POST', '/api/spaces', { title: 'x' }],
      ['PATCH', `/api/spaces/${s.id}`, { title: 'x' }],
      ['POST', `/api/spaces/${s.id}/pages`, { title: 'x' }],
      ['PATCH', `/api/pages/${p.id}`, { title: 'x' }],
      ['POST', `/api/pages/${p.id}/move`, { parentId: null, position: 0 }],
      ['DELETE', `/api/pages/${p.id}?confirm=1`],
    ];
    for (const headers of [
      { host: 'localhost:3000', origin: 'http://evil.example', cookie },
      { host: 'localhost:3000', cookie },
    ]) {
      for (const [m, url, payload] of cases) {
        const r = await app.inject({ method: m as 'GET', url, headers, ...(payload ? { payload } : {}) });
        expect(r.statusCode, `${m} ${url}`).toBe(403);
      }
    }
    expect((app.db.prepare('SELECT COUNT(*) c FROM pages').get() as { c: number }).c).toBe(1);
    expect((app.db.prepare('SELECT title FROM pages').get() as { title: string }).title).toBe('P');
  });

  it('BUG-001 DELETE có Content-Type json nhưng không body (đúng như client gửi) -> 204; script không gửi header khi không body', async () => {
    const { app, a, call, } = await setup();
    const sp = (await call(a, 'POST', '/api/spaces', { title: 'S' })).json().space.id as number;
    const p = (await call(a, 'POST', `/api/spaces/${sp}/pages`, { title: 'P' })).json().page.id as number;
    const r = await app.inject({ method: 'DELETE', url: `/api/pages/${p}`, headers: { ...a, 'content-type': 'application/json' } });
    expect(r.statusCode).toBe(204);
    const js = (await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a })).body;
    expect(js).toMatch(/if\(body\)\{o\.headers=\{'Content-Type':'application\/json'\}/);
    // JSON hỏng vẫn bị từ chối bằng envelope tiếng Việt
    const bad = await app.inject({ method: 'POST', url: '/api/spaces', headers: { ...a, 'content-type': 'application/json' }, payload: '{x' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toBe('Dữ liệu không hợp lệ.');
  });

  it('BUG-003 script bắt lỗi mạng của fetch và có thông báo tiếng Việt (error.network)', async () => {
    const { app, a } = await setup();
    const js = (await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a })).body;
    expect(js).toMatch(/function\(e\)\{return \{ok:false,status:0,j:\{\},net:true/);
    expect(js).toContain('Mất kết nối. Kiểm tra mạng và thử lại.');
  });

  it('REQ-004 /studio hiển thị khung quản lý bằng tiếng Việt, có script ngoài (CSP không cho inline)', async () => {
    const { app, a } = await setup();
    const r = await app.inject({ method: 'GET', url: '/studio', headers: a });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Tạo space');
    expect(r.body).toContain('<script src="/assets/studio.js"');
    const js = await app.inject({ method: 'GET', url: '/assets/studio.js', headers: a });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Thụt lề');
    expect(js.body).not.toMatch(/innerHTML/); // chỉ dùng textContent để tránh XSS
  });
});
