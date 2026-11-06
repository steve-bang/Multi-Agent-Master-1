// T-007 retest b6e6335: ngân sách byte /api/preview bằng request thật.
const B = process.env.BASE || 'http://127.0.0.1:3107';
const H = { 'Content-Type': 'application/json', Origin: B };
let n = 0;
async function user() {
  const r = await fetch(B + '/api/auth/register', { method: 'POST', headers: H, body: JSON.stringify({ email: `b${Date.now()}${++n}@example.com`, password: 'matkhau-12345' }) });
  const c = r.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ');
  if (!c) throw new Error('register ' + r.status + await r.text());
  return c;
}
const pv = (c, body) => fetch(B + '/api/preview', { method: 'POST', headers: { ...H, Cookie: c }, body: JSON.stringify({ bodyMd: body }) });
const tally = async (ps) => { const o = {}; for (const r of await ps) { o[r.status] = (o[r.status] || 0) + 1; await r.arrayBuffer?.(); } return o; };
const hz = async (ms) => { const lat = []; const end = Date.now() + ms; while (Date.now() < end) { const t = performance.now(); await fetch(B + '/healthz').then((r) => r.text()); lat.push(performance.now() - t); await new Promise((r) => setTimeout(r, 5)); } return lat; };
(async () => {
  const k200 = 'a'.repeat(200 * 1024), k16 = 'b'.repeat(16 * 1024);
  if (!process.env.ONLYG) {
  // (a) tuần tự 200KB
  let c = await user(), ok = 0, first429 = null;
  for (let i = 0; i < 30; i++) { const r = await pv(c, k200); await r.text(); if (r.status === 200) ok++; else if (!first429) first429 = { i, status: r.status, ra: r.headers.get('retry-after') }; }
  console.log('a) tuần tự 200KB x30: qua', ok, 'first429', JSON.stringify(first429));
  // (c) user khác
  const c2 = await user(); const r2 = await pv(c2, k200); console.log('c) user khác sau khi A bị 429:', r2.status);
  // phục hồi
  const ra = Number(first429.ra); console.log('   chờ Retry-After', ra, 's'); await new Promise((r) => setTimeout(r, (ra + 1) * 1000));
  const r3 = await pv(c, k200); console.log('f) sau Retry-After:', r3.status);
  // (b) song song
  c = await user(); const ps = []; for (let i = 0; i < 40; i++) ps.push(pv(c, k200));
  console.log('b) 40 song song 200KB:', JSON.stringify(await tally(await Promise.all(ps))));
  // (d) 16KB
  c = await user(); ok = 0; let f = null;
  for (let i = 0; i < 130; i++) { const r = await pv(c, k16); await r.text(); if (r.status === 200) ok++; else if (!f) f = { i, s: r.status }; }
  console.log('d) 16KB x130: qua', ok, JSON.stringify(f));
  // (e) CPU/event loop: 20 x 200KB tuần tự + healthz song song
  c = await user(); const hp = hz(8000); const t0 = Date.now(); let o = {};
  for (let i = 0; i < 22; i++) { const r = await pv(c, k200); await r.text(); o[r.status] = (o[r.status] || 0) + 1; }
  const tt = Date.now() - t0; const lat = await hp; lat.sort((a, b) => a - b);
  console.log('e) 20x200KB tuần tự', JSON.stringify(o), 'tổng', tt, 'ms; healthz n=', lat.length, 'p50', lat[lat.length >> 1].toFixed(1), 'max', lat[lat.length - 1].toFixed(1));
  // 20 song song
  c = await user(); const hp2 = hz(8000); const t1 = Date.now(); const o2 = await tally(await Promise.all(Array.from({ length: 20 }, () => pv(c, k200)))); const t2 = Date.now() - t1; const l2 = await hp2; l2.sort((a, b) => a - b);
  console.log('e2) 20x200KB song song', JSON.stringify(o2), 'tổng', t2, 'ms; healthz p50', l2[l2.length >> 1].toFixed(1), 'max', l2[l2.length - 1].toFixed(1));
  }
  // (g) nội dung nhỏ render nặng
  const shapes = {
    'img "![" x16KB': '!['.repeat(8 * 1024),
    'bảng 200 cột x ~16KB': '|' + Array.from({ length: 1500 }, (_, i) => 'c' + i).join('|') + '|\n|' + '---|'.repeat(1500) + '\n',
    '[ lặp 16KB': '['.repeat(16 * 1024),
    '[a](b) lặp 16KB': '[a](b)'.repeat(2700),
    '> lồng 16KB': '>'.repeat(16 * 1024) + ' x',
    '* lồng 16KB': ('  '.repeat(1) + '* x\n').repeat(3000),
    '**_ lặp 16KB': '**_'.repeat(5400),
    '``` lặp 16KB': '`'.repeat(16 * 1024),
  };
  c = await user();
  for (const [name, body] of Object.entries(shapes)) {
    const b = body.slice(0, 16 * 1024); const hp3 = hz(4000); const ts = []; let st = {};
    for (let i = 0; i < 5; i++) { const t = performance.now(); const r = await pv(c, b); await r.text(); ts.push(performance.now() - t); st[r.status] = (st[r.status] || 0) + 1; }
    const l = await hp3; l.sort((a, b) => a - b);
    console.log('g)', name, 'bytes', b.length, 'ms/request', ts.map((x) => x.toFixed(0)).join(','), JSON.stringify(st), 'healthz max', l[l.length - 1].toFixed(0));
  }
  // 16KB nặng x120 -> tổng thời gian
  const hb = shapes['img "![" x16KB'].slice(0, 16 * 1024); c = await user(); const t = Date.now(); const ho = {};
  for (let i = 0; i < 125; i++) { const r = await pv(c, hb); await r.text(); ho[r.status] = (ho[r.status] || 0) + 1; }
  console.log('g2) 125 x 16KB "![" :', JSON.stringify(ho), 'tổng', Date.now() - t, 'ms');
})().catch((e) => { console.error('ERR', e); process.exit(1); });
