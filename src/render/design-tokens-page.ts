import vi from '../i18n/vi.json' with { type: 'json' };
import { contrastRatio, isHex, parseTokens, type Token } from './tokens.js';

const t = vi as Record<string, string>;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Nền chuẩn để tính tương phản chính là token --color-bg (đọc từ cùng tokens.css).
function grade(r: number): string {
  if (r >= 4.5) return 'Đạt AA cho chữ';
  if (r >= 3) return 'Đạt 3:1 cho thành phần UI';
  return 'Chỉ trang trí';
}

export function designTokensPage(tokensCss: string): string {
  const tokens = parseTokens(tokensCss);
  const by = (prefix: string): Token[] => tokens.filter((x) => x.name.startsWith(prefix));
  const bg = tokens.find((x) => x.name === 'color-bg')?.value ?? '';

  const colors = by('color-')
    .map((x) => {
      const ratio = isHex(x.value) && isHex(bg) ? contrastRatio(x.value, bg) : null;
      return `<li class="swatch"><div class="swatch-chip sw-${x.name}" role="img" aria-label="${esc(x.name)} ${esc(x.value)}"></div><div class="swatch-body"><strong>${esc(x.name)}</strong><code>${esc(x.value)}</code>${
        ratio === null ? '' : `<span>${ratio.toFixed(1)}:1 trên nền trắng. ${esc(grade(ratio))}</span>`
      }</div></li>`;
    })
    .join('');

  const rows = (list: Token[], cell: (x: Token) => string): string =>
    `<div class="table-scroll"><table><thead><tr><th scope="col">Token</th><th scope="col">Giá trị</th><th scope="col">Mẫu</th></tr></thead><tbody>${list
      .map((x) => `<tr><th scope="row"><code>--${esc(x.name)}</code></th><td><code>${esc(x.value)}</code></td><td>${cell(x)}</td></tr>`)
      .join('')}</tbody></table></div>`;

  const sizes = by('font-size-');
  const typeRows = sizes
    .map((x) => {
      const key = x.name.slice('font-size-'.length);
      const lh = tokens.find((y) => y.name === `line-height-${key}`)?.value ?? '';
      return `<tr><th scope="row"><code>--${esc(x.name)}</code></th><td><code>${esc(x.value)} / ${esc(lh)}</code></td><td><span class="fs-${esc(key)}">Tiếng Việt: Nguyễn Thị Ánh, đường Lê Lợi</span></td></tr>`;
    })
    .join('');
  const fonts = by('font-')
    .filter((x) => x.name === 'font-sans' || x.name === 'font-mono')
    .map((x) => `<li><code>--${esc(x.name)}</code>: <code>${esc(x.value)}</code></li>`)
    .join('');

  const variants: Array<[string, string]> = [
    ['Nút chính', 'btn-primary'],
    ['Nút phụ', 'btn-secondary'],
    ['Nút nguy hiểm', 'btn-danger'],
  ];
  const buttons = variants
    .map(
      ([label, cls]) => `<div><h3>${label}</h3><div class="demo-grid">
<div><p class="demo-label">Mặc định</p><button type="button" class="btn ${cls}">${label}</button></div>
<div><p class="demo-label">Hover</p><button type="button" class="btn ${cls} state-hover">${label}</button></div>
<div><p class="demo-label">Focus</p><button type="button" class="btn ${cls} state-focus">${label}</button></div>
<div><p class="demo-label">Vô hiệu hóa</p><button type="button" class="btn ${cls}" disabled>${label}</button></div>
</div></div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Token thiết kế - ${esc(t['app.name'])}</title>
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/app.css">
<link rel="stylesheet" href="/assets/design-tokens.css">
</head>
<body>
<a class="skip-link" href="#main">${esc(t['app.skip'])}</a>
<header class="topbar"><span class="brand">${esc(t['app.name'])}</span></header>
<main id="main" class="doc">
<h1>Token thiết kế</h1>
<p class="muted">Giá trị đọc trực tiếp từ <code>tokens.css</code>. Tỉ lệ tương phản được tính với nền trắng (${esc(bg)}).</p>

<section aria-labelledby="h-color"><h2 id="h-color">Màu</h2><ul class="swatches">${colors}</ul></section>

<section aria-labelledby="h-type"><h2 id="h-type">Chữ</h2>
<ul>${fonts}</ul>
<div class="table-scroll"><table><thead><tr><th scope="col">Token</th><th scope="col">Cỡ / dòng</th><th scope="col">Mẫu</th></tr></thead><tbody>${typeRows}</tbody></table></div>
</section>

<section aria-labelledby="h-space"><h2 id="h-space">Khoảng cách</h2>${rows(by('space-'), (x) => `<div class="bar w-${esc(x.name)}"></div>`)}</section>

<section aria-labelledby="h-radius"><h2 id="h-radius">Bo góc</h2>${rows(by('radius-'), (x) => `<div class="radius-box r-${esc(x.name)}"></div>`)}</section>

<section aria-labelledby="h-btn"><h2 id="h-btn">Nút</h2>${buttons}</section>

<section aria-labelledby="h-input"><h2 id="h-input">Ô nhập</h2><div class="demo-grid">
<div><label for="d-default">Mặc định</label><input id="d-default" type="text" placeholder="ten@congty.vn"></div>
<div><label for="d-focus">Focus</label><input id="d-focus" type="text" class="state-focus-input" value="Đang nhập"></div>
<div><label for="d-error">Lỗi</label><input id="d-error" type="email" aria-invalid="true" aria-describedby="d-error-msg" value="abc"><p id="d-error-msg" class="field-error-msg">${esc(t['auth.error.email_invalid'])}</p></div>
<div><label for="d-disabled">Vô hiệu hóa</label><input id="d-disabled" type="text" value="Không sửa được" disabled></div>
</div></section>

<section aria-labelledby="h-alert"><h2 id="h-alert">Khung thông báo</h2>
<div class="alert" role="presentation">${esc(t['auth.error.bad_credentials'])}</div>
<div class="alert alert-success" role="presentation">Đã lưu lúc 09:30.</div>
</section>

<section aria-labelledby="h-focus"><h2 id="h-focus">Vòng focus</h2>
<p>Vòng focus dày 2px, lệch 2px, màu <code>--color-focus</code>. Dùng phím Tab trên các nút ở trên để thấy vòng focus thật.</p>
<a class="btn btn-secondary state-focus" href="#h-focus">Liên kết đang focus</a>
</section>
</main>
</body>
</html>`;
}
