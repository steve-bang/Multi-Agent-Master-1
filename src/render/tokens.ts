export type Token = { name: string; value: string };

/** Đọc các biến `--tên: giá trị;` từ nội dung tokens.css (bỏ chú thích). */
export function parseTokens(css: string): Token[] {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Token[] = [];
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out.push({ name: m[1], value: m[2].trim() });
  return out;
}

export const isHex = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Tỉ lệ tương phản WCAG 2.x giữa hai màu dạng #RRGGBB. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** CSS sinh từ token cho trang /design-tokens (không dùng style nội tuyến vì CSP). */
export function designTokensCss(tokens: Token[]): string {
  const rules: string[] = [];
  for (const t of tokens) {
    if (t.name.startsWith('color-')) rules.push(`.sw-${t.name}{background:var(--${t.name})}`);
    else if (t.name.startsWith('space-')) rules.push(`.w-${t.name}{width:var(--${t.name})}`);
    else if (t.name.startsWith('radius-')) rules.push(`.r-${t.name}{border-radius:var(--${t.name})}`);
    else if (/^font-size-/.test(t.name)) {
      const key = t.name.slice('font-size-'.length);
      rules.push(`.fs-${key}{font-size:var(--${t.name});line-height:var(--line-height-${key})}`);
    }
  }
  return rules.join('\n') + '\n';
}
