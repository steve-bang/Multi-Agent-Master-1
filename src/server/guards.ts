import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { userFromSession, type AuthUser } from '../auth/service.js';
import { COOKIE, fail, isProd, readCookie } from './http.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Guard toàn app (đăng ký trên root trước mọi plugin): request ghi phải có Origin trùng Host. */
export function registerGlobalGuards(app: FastifyInstance): void {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req, reply) => {
    // Client có thể gửi Content-Type: application/json cho request không body (vd. DELETE): coi như không có body,
    // nếu không Fastify trả 400 FST_ERR_CTP_EMPTY_JSON_BODY.
    const cl = req.headers['content-length'];
    if ((cl === undefined || cl === '0') && !req.headers['transfer-encoding']) delete req.headers['content-type'];
    if (SAFE.has(req.method)) return;
    let ok = false;
    if (req.headers.origin) {
      try {
        ok = new URL(req.headers.origin).host === req.headers.host;
      } catch {
        ok = false;
      }
    }
    if (!ok) return fail(reply, 403, 'FORBIDDEN_ORIGIN');
  });
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'same-origin');
    // Ảnh theo URL: production chỉ https:; http: chỉ để dev/test (production bị mixed content chặn).
    const img = isProd() ? "'self' https:" : "'self' http: https:";
    reply.header(
      'Content-Security-Policy',
      `default-src 'self'; img-src ${img}; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
    );
    const u = req.url;
    if (u.startsWith('/api/') || u.startsWith('/studio') || u.startsWith('/dang-')) {
      reply.header('Cache-Control', 'no-store');
    }
  });
}

/** preHandler dùng chung: API -> 401 JSON; trang -> 302 /dang-nhap. Gán req.user khi hợp lệ. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = userFromSession(req.server.db, readCookie(req, COOKIE));
  if (user) {
    req.user = user;
    return;
  }
  if (req.url.startsWith('/api/')) {
    await fail(reply, 401, 'UNAUTHENTICATED');
    return;
  }
  await reply.redirect('/dang-nhap', 302);
}
