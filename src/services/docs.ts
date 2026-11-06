import type { Db } from '../db/index.js';

export const MAX_DEPTH = 4;
export const MAX_PAGES_PER_SPACE = 500;
export const MAX_TITLE = 200;
export const MAX_SLUG = 80;

export class DocsError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
const notFound = () => new DocsError(404, 'NOT_FOUND');

export type Space = { id: number; title: string; slug: string; published: boolean };
export type PageRow = { id: number; title: string; slug: string; parentId: number | null; position: number };
export type TreeNode = PageRow & { children: TreeNode[] };

/** Tiêu đề -> slug: bỏ dấu tiếng Việt, đ->d, chữ thường, gạch ngang. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
}

function cleanTitle(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new DocsError(400, 'TITLE_REQUIRED');
  if ([...s].length > MAX_TITLE) throw new DocsError(400, 'TITLE_TOO_LONG');
  return s;
}

function cleanSlug(v: unknown, fallbackTitle: string, fallback: string): string {
  if (v === undefined || v === null || v === '') return slugify(fallbackTitle) || fallback;
  if (typeof v !== 'string') throw new DocsError(400, 'SLUG_INVALID');
  const s = v.trim().toLowerCase();
  if (s.length > MAX_SLUG || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) throw new DocsError(400, 'SLUG_INVALID');
  return s;
}

/** Thêm hậu tố -2, -3... cho tới khi chưa tồn tại (chạy trong transaction cùng lúc ghi). */
function uniqueSlug(base: string, exists: (s: string) => boolean): string {
  if (!exists(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const cand = base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/g, '') + suffix;
    if (!exists(cand)) return cand;
  }
}

type SpaceDb = { id: number; title: string; slug: string; published: number };
const toSpace = (r: SpaceDb): Space => ({ id: r.id, title: r.title, slug: r.slug, published: r.published === 1 });

export function parseId(v: unknown): number | null {
  return typeof v === 'string' && /^[1-9]\d{0,14}$/.test(v) ? Number(v) : null;
}

function ownedSpace(db: Db, owner: number, spaceId: number | null): SpaceDb {
  const r =
    spaceId === null
      ? undefined
      : (db.prepare('SELECT id,title,slug,published FROM spaces WHERE id=? AND owner_id=?').get(spaceId, owner) as
          | SpaceDb
          | undefined);
  if (!r) throw notFound();
  return r;
}

type PageDb = { id: number; space_id: number; parent_id: number | null; title: string; slug: string; position: number };
const toRow = (p: PageDb): PageRow => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  parentId: p.parent_id,
  position: p.position,
});

function ownedPage(db: Db, owner: number, pageId: number | null): PageDb {
  const r =
    pageId === null
      ? undefined
      : (db
          .prepare(
            'SELECT p.id,p.space_id,p.parent_id,p.title,p.slug,p.position FROM pages p JOIN spaces s ON s.id=p.space_id WHERE p.id=? AND s.owner_id=?',
          )
          .get(pageId, owner) as PageDb | undefined);
  if (!r) throw notFound();
  return r;
}

export function listSpaces(db: Db, owner: number): Space[] {
  return (
    db.prepare('SELECT id,title,slug,published FROM spaces WHERE owner_id=? ORDER BY id').all(owner) as SpaceDb[]
  ).map(toSpace);
}

export function createSpace(db: Db, owner: number, titleIn: unknown): Space {
  const title = cleanTitle(titleIn);
  return db.transaction(() => {
    const slug = uniqueSlug(slugify(title) || 'space', (s) => !!db.prepare('SELECT 1 FROM spaces WHERE slug=?').get(s));
    const id = db.prepare('INSERT INTO spaces (owner_id,title,slug) VALUES (?,?,?)').run(owner, title, slug)
      .lastInsertRowid;
    return toSpace(db.prepare('SELECT id,title,slug,published FROM spaces WHERE id=?').get(id) as SpaceDb);
  })();
}

export function renameSpace(db: Db, owner: number, spaceId: number | null, titleIn: unknown): Space {
  return db.transaction(() => {
    ownedSpace(db, owner, spaceId);
    const title = cleanTitle(titleIn);
    db.prepare('UPDATE spaces SET title=? WHERE id=? AND owner_id=?').run(title, spaceId, owner);
    return toSpace(ownedSpace(db, owner, spaceId));
  })();
}

function loadPages(db: Db, spaceId: number): PageDb[] {
  return db
    .prepare('SELECT id,space_id,parent_id,title,slug,position FROM pages WHERE space_id=? ORDER BY position,id')
    .all(spaceId) as PageDb[];
}

function buildTree(pages: PageDb[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>(pages.map((p) => [p.id, { ...toRow(p), children: [] }]));
  const roots: TreeNode[] = [];
  for (const p of pages) {
    const n = nodes.get(p.id)!;
    const parent = p.parent_id === null ? undefined : nodes.get(p.parent_id);
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}

export function getTree(db: Db, owner: number, spaceId: number | null): TreeNode[] {
  const s = ownedSpace(db, owner, spaceId);
  return buildTree(loadPages(db, s.id));
}

function depthOf(byId: Map<number, PageDb>, id: number | null): number {
  let d = 0;
  for (let cur = id; cur !== null && d < 1000; d++) {
    const p = byId.get(cur);
    if (!p) break;
    cur = p.parent_id;
  }
  return d;
}

function height(pages: PageDb[], id: number): number {
  const kids = pages.filter((p) => p.parent_id === id);
  return 1 + Math.max(0, ...kids.map((k) => height(pages, k.id)));
}

function parentInput(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new DocsError(400, 'INVALID_INPUT');
  return v;
}

export function createPage(
  db: Db,
  owner: number,
  spaceId: number | null,
  body: { title?: unknown; slug?: unknown; parentId?: unknown },
): PageRow {
  return db.transaction(() => {
    const s = ownedSpace(db, owner, spaceId);
    const title = cleanTitle(body.title);
    const slugBase = cleanSlug(body.slug, title, 'trang');
    const parentId = parentInput(body.parentId);
    const pages = loadPages(db, s.id);
    if (pages.length >= MAX_PAGES_PER_SPACE) throw new DocsError(400, 'TOO_MANY_PAGES');
    const byId = new Map(pages.map((p) => [p.id, p]));
    if (parentId !== null && !byId.has(parentId)) throw notFound();
    if (depthOf(byId, parentId) + 1 > MAX_DEPTH) throw new DocsError(400, 'TOO_DEEP');
    const slug = uniqueSlug(slugBase, (x) => pages.some((p) => p.slug === x));
    const position = pages.filter((p) => p.parent_id === parentId).length;
    const id = db
      .prepare('INSERT INTO pages (space_id,parent_id,title,slug,position) VALUES (?,?,?,?,?)')
      .run(s.id, parentId, title, slug, position).lastInsertRowid;
    return toRow(ownedPage(db, owner, Number(id)));
  })();
}

export function getPage(db: Db, owner: number, pageId: number | null): PageRow {
  return toRow(ownedPage(db, owner, pageId));
}

/** Đổi tiêu đề; slug giữ nguyên (URL ổn định). */
export function renamePage(db: Db, owner: number, pageId: number | null, titleIn: unknown): PageRow {
  return db.transaction(() => {
    ownedPage(db, owner, pageId);
    const title = cleanTitle(titleIn);
    db.prepare('UPDATE pages SET title=? WHERE id=?').run(title, pageId);
    return toRow(ownedPage(db, owner, pageId));
  })();
}

export function movePage(
  db: Db,
  owner: number,
  pageId: number | null,
  body: { parentId?: unknown; position?: unknown },
): TreeNode[] {
  return db.transaction(() => {
    const page = ownedPage(db, owner, pageId);
    const parentId = parentInput(body.parentId);
    const pos = body.position;
    if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 0 || pos > 100000) {
      throw new DocsError(400, 'INVALID_INPUT');
    }
    const pages = loadPages(db, page.space_id);
    const byId = new Map(pages.map((p) => [p.id, p]));
    if (parentId !== null && !byId.has(parentId)) throw notFound(); // trang khác space/người khác
    for (let cur: number | null = parentId, n = 0; cur !== null && n < 1000; n++) {
      if (cur === page.id) throw new DocsError(400, 'CYCLE');
      cur = byId.get(cur)?.parent_id ?? null;
    }
    if (depthOf(byId, parentId) + height(pages, page.id) > MAX_DEPTH) throw new DocsError(400, 'TOO_DEEP');
    const siblings = pages.filter((p) => p.parent_id === parentId && p.id !== page.id).map((p) => p.id);
    siblings.splice(Math.min(pos, siblings.length), 0, page.id);
    db.prepare('UPDATE pages SET parent_id=? WHERE id=?').run(parentId, page.id);
    const upd = db.prepare('UPDATE pages SET position=? WHERE id=?');
    siblings.forEach((id, i) => upd.run(i, id));
    if (page.parent_id !== parentId) {
      loadPages(db, page.space_id)
        .filter((p) => p.parent_id === page.parent_id)
        .forEach((p, i) => upd.run(i, p.id));
    }
    return buildTree(loadPages(db, page.space_id));
  })();
}

export function countDescendants(db: Db, pageId: number): number {
  return (
    db
      .prepare(
        'WITH RECURSIVE d(id) AS (SELECT id FROM pages WHERE parent_id=? UNION ALL SELECT p.id FROM pages p JOIN d ON p.parent_id=d.id) SELECT COUNT(*) c FROM d',
      )
      .get(pageId) as { c: number }
  ).c;
}

/** Xóa trang; có trang con thì bắt buộc confirm (đếm và xóa cùng một transaction). */
export function deletePage(db: Db, owner: number, pageId: number | null, confirm: boolean): void {
  db.transaction(() => {
    const page = ownedPage(db, owner, pageId);
    const children = countDescendants(db, page.id);
    if (children > 0 && !confirm) throw new DocsError(400, 'CONFIRM_REQUIRED', { childCount: children });
    db.prepare('DELETE FROM pages WHERE id=?').run(page.id); // ON DELETE CASCADE xóa cả cây
    const upd = db.prepare('UPDATE pages SET position=? WHERE id=?');
    loadPages(db, page.space_id)
      .filter((p) => p.parent_id === page.parent_id)
      .forEach((p, i) => upd.run(i, p.id));
  })();
}
