import crypto from 'crypto';
import type { Request, Response, NextFunction, Express } from 'express';

export const DEFAULT_APP_PASSWORD = 'Vicky xinh đẹp';

// Secret key for HMAC token signing (falls back to stable internal secret if not configured in env)
const AUTH_SECRET = process.env.APP_SECRET || process.env.APP_AUTH_SECRET || 'pm-auth-secret-vicky-2026-secure';

export interface SessionUserPayload {
  id: number;
  login: string;
  firstname?: string;
  lastname?: string;
  mail?: string;
}

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
 * Generate a signed session token:
 * - 3 parts (legacy): <timestamp>.<nonce>.<signature>
 * - 4 parts (user payload): <timestamp>.<base64urlUser>.<nonce>.<signature>
 * Token valid for 7 days by default
 */
export function createSessionToken(validDays = 7, userPayload?: SessionUserPayload): string {
  const expiresAt = Date.now() + validDays * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');

  if (userPayload) {
    const userSegment = Buffer.from(JSON.stringify(userPayload)).toString('base64url');
    const payload = `${expiresAt}.${userSegment}.${nonce}`;
    const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  const payload = `${expiresAt}.${nonce}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verify session token validity and expiration (supports both 3-part and 4-part tokens)
 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 4) return false;

  let expiresAt: number;
  let signature: string;
  let payload: string;

  if (parts.length === 3) {
    const [expiresAtStr, nonce, sig] = parts;
    expiresAt = Number(expiresAtStr);
    signature = sig;
    payload = `${expiresAtStr}.${nonce}`;
  } else {
    const [expiresAtStr, userSegment, nonce, sig] = parts;
    expiresAt = Number(expiresAtStr);
    signature = sig;
    payload = `${expiresAtStr}.${userSegment}.${nonce}`;
  }

  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Extract decoded user payload from session token if present
 */
export function getUserFromToken(token: string | null | undefined): SessionUserPayload | null {
  if (!token || !verifySessionToken(token)) return null;
  const parts = token.split('.');
  if (parts.length === 4) {
    try {
      const json = Buffer.from(parts[1], 'base64url').toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
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
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { password, redmineApiKey, baseUrl } = req.body || {};

    // 1. Luồng đăng nhập cá nhân bằng Redmine API Key (Multi-User)
    if (redmineApiKey && typeof redmineApiKey === 'string' && redmineApiKey.trim()) {
      const trimmedKey = redmineApiKey.trim();
      const targetUrl = (typeof baseUrl === 'string' && baseUrl.trim())
        ? baseUrl.trim().replace(/\/+$/, '')
        : (process.env.REDMINE_URL || 'https://redmine.anybim.vn').replace(/\/+$/, '');

      try {
        const fetchUrl = `${targetUrl}/users/current.json`;
        const redmineRes = await fetch(fetchUrl, {
          headers: {
            'X-Redmine-API-Key': trimmedKey,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!redmineRes.ok) {
          return res.status(401).json({
            ok: false,
            error: 'Redmine API Key không chính xác hoặc đã hết hạn trên Redmine. Vui lòng kiểm tra lại.',
          });
        }

        const data: any = await redmineRes.json();
        const user = data.user;
        if (!user || !user.id) {
          return res.status(401).json({
            ok: false,
            error: 'Không tìm thấy hồ sơ người dùng tương ứng với API Key này.',
          });
        }

        const userPayload: SessionUserPayload = {
          id: user.id,
          login: user.login,
          firstname: user.firstname,
          lastname: user.lastname,
          mail: user.mail,
        };

        const token = createSessionToken(7, userPayload);
        return res.json({
          ok: true,
          token,
          user: userPayload,
          message: `Chào mừng ${user.firstname || ''} ${user.lastname || ''} (${user.login})!`,
        });
      } catch (err: any) {
        return res.status(500).json({
          ok: false,
          error: `Không thể kết nối đến Redmine: ${err.message || 'Lỗi mạng hoặc Timeout'}`,
        });
      }
    }

    // 2. Luồng đăng nhập mật khẩu hệ thống (Legacy / Admin)
    if (!password || !verifyPassword(password)) {
      return res.status(401).json({
        ok: false,
        error: 'Mật khẩu hoặc Redmine API Key không chính xác. Vui lòng thử lại.',
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
    const user = getUserFromToken(token);
    return res.json({ authenticated: valid, user });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    return res.json({ ok: true, message: 'Đã đăng xuất' });
  });
}
