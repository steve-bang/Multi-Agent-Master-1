import type { FastifyInstance, FastifyReply } from 'fastify';
import * as svc from '../services/docs.js';
import { MSG } from '../server/http.js';
import { renderMarkdown } from '../render/markdown.js';
import { requireAuth } from '../server/guards.js';

const PREVIEW_WINDOW_MS = 60_000;
// 120/phút/user: người gõ thật + debounce 800 ms + hủy request cũ chỉ tạo vài chục request/phút; 120 là biên an toàn
// mà vẫn chặn lạm dụng (mỗi request render tối đa 200 KB).
const PREVIEW_MAX = 120;

type Id ={ Params: { id?: string; pid?: string } };

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  // Mọi route trong plugin này đều yêu cầu đăng nhập; chủ sở hữu kiểm tra trong service (404 nếu không phải chủ).
  app.addHook('preHandler', requireAuth);
  const uid = (req: { user: { id: number } | null }): number => req.user!.id;
  const run = (reply: FastifyReply, fn: () => unknown, okStatus = 200) => {
    try {
      const out = fn();
      return out === undefined ? reply.code(204).send() : reply.code(okStatus).send(out);
    } catch (e) {
      if (e instanceof svc.DocsError) {
        return reply.code(e.status).send({ error: { code: e.code, message: MSG[e.code], ...e.extra } });
      }
      throw e;
    }
  };
  const body = (req: { body: unknown }) =>
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

  app.get('/api/spaces', (req, reply) => run(reply, () => ({ spaces: svc.listSpaces(app.db, uid(req)) })));
  app.post('/api/spaces', (req, reply) =>
    run(reply, () => ({ space: svc.createSpace(app.db, uid(req), body(req).title) }), 201),
  );
  app.patch<Id>('/api/spaces/:id', (req, reply) =>
    run(reply, () => ({ space: svc.renameSpace(app.db, uid(req), svc.parseId(req.params.id), body(req).title) })),
  );
  app.get<Id>('/api/spaces/:id/tree', (req, reply) =>
    run(reply, () => ({ tree: svc.getTree(app.db, uid(req), svc.parseId(req.params.id)) })),
  );
  app.post<Id>('/api/spaces/:id/pages', (req, reply) =>
    run(reply, () => ({ page: svc.createPage(app.db, uid(req), svc.parseId(req.params.id), body(req)) }), 201),
  );
  app.get<Id>('/api/pages/:pid', (req, reply) =>
    run(reply, () => ({ page: svc.getPage(app.db, uid(req), svc.parseId(req.params.pid)) })),
  );
  app.patch<Id>('/api/pages/:pid', (req, reply) =>
    run(reply, () => ({ page: svc.updatePage(app.db, uid(req), svc.parseId(req.params.pid), body(req)) })),
  );
  // Xem trước: chỉ render, không chạm DB; dùng chung renderMarkdown với trang đọc công khai.
  // Rate limit theo user (cửa sổ cố định 60 s, tối đa 120): kiểm tra + ghi hoàn toàn đồng bộ trước khi render,
  // nên request đồng thời không lách được; bộ đếm nằm trong bộ nhớ tiến trình (1 instance).
  const previewHits = new Map<number, { start: number; count: number }>();
  app.post('/api/preview', (req, reply) => {
    const now = Date.now();
    if (previewHits.size > 1000) for (const [k, v] of previewHits) if (now - v.start >= PREVIEW_WINDOW_MS) previewHits.delete(k);
    let h = previewHits.get(uid(req));
    if (!h || now - h.start >= PREVIEW_WINDOW_MS) {
      h = { start: now, count: 0 };
      previewHits.set(uid(req), h);
    }
    if (h.count >= PREVIEW_MAX) {
      reply.header('Retry-After', String(Math.max(1, Math.ceil((h.start + PREVIEW_WINDOW_MS - now) / 1000))));
      return reply.code(429).send({ error: { code: 'PREVIEW_RATE_LIMITED', message: MSG.PREVIEW_RATE_LIMITED } });
    }
    h.count++;
    return run(reply, () => ({ html: renderMarkdown(svc.cleanBody(body(req).bodyMd)) }));
  });
  app.post<Id>('/api/pages/:pid/move', (req, reply) =>
    run(reply, () => ({ tree: svc.movePage(app.db, uid(req), svc.parseId(req.params.pid), body(req)) })),
  );
  app.delete<Id & { Querystring: { confirm?: string } }>('/api/pages/:pid', (req, reply) =>
    run(reply, () => {
      svc.deletePage(app.db, uid(req), svc.parseId(req.params.pid), req.query.confirm === '1');
    }),
  );
}
