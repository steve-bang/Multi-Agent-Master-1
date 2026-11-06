import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

/**
 * Hàm render DUY NHẤT Markdown -> HTML an toàn; dùng cho xem trước (REQ-005) và trang đọc công khai (T-008).
 * Lớp 1: markdown-it html:false (HTML thô bị escape) + validateLink allowlist.
 * Lớp 2: sanitize-html allowlist thẻ/thuộc tính/scheme trên đầu ra.
 */

const ABSOLUTE_LINK = /^(https?:|mailto:)/i;
const ABSOLUTE_HTTP = /^https?:\/\//i;
// Bỏ ký tự điều khiển/khoảng trắng mà trình duyệt bỏ qua khi phân tích scheme (vd "java\tscript:").
const isInvisible = (c: number): boolean =>
  c <= 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0xad || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff;
const stripInvisible = (s: string): string => [...s].filter((ch) => !isInvisible(ch.codePointAt(0)!)).join('');

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
export const validateLink = (url: string): boolean => {
  const u = stripInvisible(url);
  return ABSOLUTE_LINK.test(u) || u.startsWith('#');
};
md.validateLink = validateLink;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'code', 'pre',
    'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'loading', 'referrerpolicy'],
    code: ['class'],
  },
  allowedClasses: { code: [/^language-[\w-]+$/ as unknown as string] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tag, attribs) => {
      const href = attribs.href ?? '';
      const out: sanitizeHtml.Attributes = {};
      if (attribs.title) out.title = attribs.title;
      if (ABSOLUTE_LINK.test(stripInvisible(href)) || href.startsWith('#')) {
        out.href = href;
        out.rel = 'noopener noreferrer nofollow';
      }
      return { tagName: tag, attribs: out };
    },
    img: (tag, attribs) => {
      const out: sanitizeHtml.Attributes = { loading: 'lazy', referrerpolicy: 'no-referrer' };
      if (ABSOLUTE_HTTP.test(attribs.src ?? '')) out.src = attribs.src;
      if (attribs.alt !== undefined) out.alt = attribs.alt;
      if (attribs.title) out.title = attribs.title;
      return { tagName: tag, attribs: out };
    },
  },
  // Ảnh không có src http/https hợp lệ thì bỏ hẳn thẻ.
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

/** Lớp 1 riêng (chỉ để test từng lớp): markdown-it, chưa sanitize. */
export const renderLayer1 = (source: string): string => md.render(source);
/** Lớp 2 riêng (chỉ để test từng lớp): sanitize-html trên HTML bất kỳ. */
export const sanitizeLayer2 = (html: string): string => sanitizeHtml(html, OPTIONS);

export function renderMarkdown(source: string): string {
  return sanitizeLayer2(renderLayer1(source));
}
