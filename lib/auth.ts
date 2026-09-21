import crypto from 'crypto';
import type { Request, Response, NextFunction, Express } from 'express';

export const DEFAULT_APP_PASSWORD = 'Vicky xinh đẹp';

// Secret key for HMAC token signing (falls back to stable internal secret if not configured in env)
const AUTH_SECRET = process.env.APP_SECRET || process.env.APP_AUTH_SECRET || 'pm-auth-secret-vicky-2026-secure';

export function getAppPassword(): string {
  return (process.env.APP_ACCESS_PASSWORD || process.env.APP_PASSWORD || DEFAULT_APP_PASSWORD).trim();
}

/**
 * Timing-safe password verification
 */
export function verifyPassword(inputPassword: string): boolean {
  if (typeof inputPassword !== 'string') return false;
  const expectedPassword = getAppPassword();

  // Hash both with SHA-256 to ensure identical buffer length for timingSafeEqual
  const inputHash = crypto.createHash('sha256').update(inputPassword.normalize('NFC').trim()).digest();
  const expectedHash = crypto.createHash('sha256').update(expectedPassword.normalize('NFC').trim()).digest();

  return crypto.timingSafeEqual(inputHash, expectedHash);
}

/**
 * Generate a signed session token: <timestamp>.<nonce>.<signature>
 * Token valid for 7 days by default
 */
export function createSessionToken(validDays = 7): string {
  const expiresAt = Date.now() + validDays * 24 * 60 * 60 * 1000;
  const payload = `${expiresAt}.${crypto.randomBytes(8).toString('hex')}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verify session token validity and expiration
 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresAtStr, nonce, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const payload = `${expiresAtStr}.${nonce}`;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Extract token from request headers (Authorization: Bearer <token> or x-app-token)
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers['x-app-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return null;
}

/**
 * Express middleware to enforce authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // If running in unit test mode and not explicitly enforcing auth for the auth tests, permit request
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_ENFORCE_AUTH) {
    return next();
  }

  const token = extractToken(req);
  if (!token || !verifySessionToken(token)) {
    return res.status(401).json({
      error: 'Yêu cầu đăng nhập để truy cập tài nguyên này.',
      code: 'UNAUTHORIZED',
    });
  }
  next();
}

/**
 * Register auth endpoints (/api/auth/login, /api/auth/check, /api/auth/logout)
 */
export function registerAuthRoutes(app: Express) {
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { password } = req.body || {};
    if (!password || !verifyPassword(password)) {
      return res.status(401).json({
        ok: false,
        error: 'Mật khẩu không chính xác. Vui lòng thử lại.',
      });
    }

    const token = createSessionToken();
    return res.json({
      ok: true,
      token,
      message: 'Đăng nhập thành công',
    });
  });

  app.get('/api/auth/check', (req: Request, res: Response) => {
    const token = extractToken(req);
    const valid = verifySessionToken(token);
    return res.json({ authenticated: valid });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    return res.json({ ok: true, message: 'Đã đăng xuất' });
  });
}
