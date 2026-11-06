const BASE = process.env.BASE || 'http://127.0.0.1:3101';
const H = { 'Content-Type': 'application/json', Origin: BASE };
const MAX = 204800;
const fit = (unit) => unit.repeat(Math.floor(MAX / Buffer.byteLength(unit))).slice(0, MAX);
const cases = {
  '"[" lặp': fit('['),
  '"[a](" lặp': fit('[a]('),
  '"![" lặp': fit('!['),
  'nhiều đoạn ngắn "a\\n\\n"': fit('a\n\n'),
  'bảng lớn (hàng "| a | b | c |")': '| h1 | h2 | h3 |\n|---|---|---|\n' + fit('| a | b | c |\n').slice(0, MAX - 40),
  'bảng 1 hàng 5000 cột': '|' + 'a|'.repeat(5000) + '\n|' + '-|'.repeat(5000) + '\n' + fit('|' + 'b|'.repeat(5000) + '\n').slice(0, 150000),
  '"*a " lặp': fit('*a '),
  '"**_" lặp': fit('**_'),
  '"`" lặp': fit('`'),
  '"> " lồng blockquote': fit('> '),
  '"- " + lồng danh sách (thụt 2)': Array.from({ length: 4000 }, (_, i) => ' '.repeat(i % 100 * 2) + '- x').join('\n').slice(0, MAX),
  '"<" lặp': fit('<'),
  '"&" lặp': fit('&'),
  'link tham chiếu "[a]: b\\n" lặp': fit('[a]: b\n') + '[a]',
  'link dài 200KB': '[x](https://a.com/' + 'a'.repeat(MAX - 30) + ')',
  'tiêu đề "# a\\n" lặp': fit('# a\n'),
  'code block 200KB': '```\n' + 'a'.repeat(MAX - 10) + '\n```',
  'tiếng Việt+emoji 200KB': fit('Việt😀 '),
};
(async () => {
  const email = `p${Date.now()}@example.com`;
  const rr = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: H, body: JSON.stringify({ email, password: 'matkhau-12345' }) });
  const cookie = rr.headers.get('set-cookie').split(';')[0]; const HH = { ...H, cookie };
  let blocked = []; let stop = false;
  // ping nhịp event loop qua /healthz
  const ping = async () => { while (!stop) { const t = performance.now(); await fetch(BASE + '/healthz').then((r) => r.text()); blocked.push(performance.now() - t); await new Promise((r) => setTimeout(r, 10)); } };
  let n = 0; const rows = [];
  for (const [name, body] of Object.entries(cases)) {
    if (n++ >= 28) break;
    blocked = []; stop = false; const pg = ping(); await new Promise((r) => setTimeout(r, 50)); blocked = [];
    const t = performance.now();
    const r = await fetch(BASE + '/api/preview', { method: 'POST', headers: HH, body: JSON.stringify({ bodyMd: body }) });
    const txt = await r.text(); const ms = performance.now() - t; stop = true; await pg;
    rows.push(`${String(Math.round(ms)).padStart(6)} ms  status ${r.status}  bytes_in=${Buffer.byteLength(body)} out=${txt.length}  healthz_max=${Math.round(Math.max(0, ...blocked))}ms  ${name}`);
  }
  console.log(rows.join('\n'));
  // lặp ca tệ nhất 3 lần + 2 request đồng thời
})();
