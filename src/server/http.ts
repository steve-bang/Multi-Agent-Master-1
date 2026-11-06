import type { FastifyReply, FastifyRequest } from 'fastify';
import vi from '../i18n/vi.json' with { type: 'json' };

const t = vi as Record<string, string>;
export const MSG: Record<string, string> = {
  EMAIL_INVALID: t['auth.error.email_invalid'],
  PASSWORD_WEAK: t['auth.error.password_weak'],
  EMAIL_EXISTS: t['auth.error.email_exists'],
  BAD_CREDENTIALS: t['auth.error.bad_credentials'],
  RATE_LIMITED: t['auth.error.rate_limited'],
  FORBIDDEN_ORIGIN: t['auth.error.forbidden_origin'],
  UNAUTHENTICATED: t['auth.error.unauthenticated'],
};

export function fail(reply: FastifyReply, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: MSG[code] } });
}

export const COOKIE = 'sid';

export function readCookie(req: FastifyRequest, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
