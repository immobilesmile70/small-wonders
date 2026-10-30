import crypto from 'node:crypto';
import { MAX_REQUEST_BODY_BYTES } from '../../src/schemas/entry';
import type { ApiErrorResponse, ApiSuccessResponse } from '../../src/types/journal';
import { getAdminBackend, type DecodedAuthToken } from './firebaseAdmin';
import { enforceRateLimit, extractTrustedClientIp, type RateLimitOperation } from './rateLimit';

export interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}

export interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  setHeader: (name: string, value: string) => VercelResponseLike;
  json: (body: unknown) => void;
  end: () => void;
}

export class ApiHttpError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ApiErrorResponse['error']['code'];
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly headers?: Record<string, string>;

  constructor(params: {
    statusCode: number;
    errorCode: ApiErrorResponse['error']['code'];
    message: string;
    fieldErrors?: Record<string, string[]>;
    headers?: Record<string, string>;
  }) {
    super(params.message);
    this.name = 'ApiHttpError';
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.fieldErrors = params.fieldErrors;
    this.headers = params.headers;
  }
}

/**
 * Wraps an asynchronous operation in a strict timeout so a hung upstream call
 * never hangs the serverless invocation until platform termination.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiHttpError({
          statusCode: 503,
          errorCode: 'SERVICE_UNAVAILABLE',
          message: 'The operation timed out before completion. Please try again.',
        })
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Structured server-side logger.
 * Explicitly avoids logging bearer tokens, cookies, credentials, or private journal text.
 */
export function logStructuredEvent(event: {
  level: 'info' | 'warn' | 'error';
  requestId: string;
  route: string;
  method?: string;
  statusCode: number;
  durationMs: number;
  errorCode?: string;
  uidHash?: string;
}): void {
  if (process.env.SILENCE_API_LOGS === 'true') {
    return;
  }
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (event.level === 'error') {
    console.error(logEntry);
  } else {
    console.log(logEntry);
  }
}

export function hashUidForAudit(uid: string): string {
  return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 12);
}

export function applyStandardSecurityHeaders(res: VercelResponseLike, requestId: string): void {
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

/**
 * Enforces explicit origin validation against `ALLOWED_ORIGINS` when an `Origin` header is present.
 * Never sets wildcard `Access-Control-Allow-Origin: *` on authenticated mutation endpoints.
 */
export function validateOriginAndApplyCors(req: VercelRequestLike, res: VercelResponseLike): void {
  const originHeader = req.headers['origin'];
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!origin) {
    return;
  }

  const configuredOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!configuredOrigins.includes(origin)) {
    throw new ApiHttpError({
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Request origin is not permitted.',
    });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
}

export function assertMethodAllowed(
  req: VercelRequestLike,
  res: VercelResponseLike,
  allowedMethods: readonly string[]
): boolean {
  const method = (req.method || '').toUpperCase();
  const allowHeader = [...allowedMethods, 'OPTIONS'].join(', ');

  if (method === 'OPTIONS') {
    res.setHeader('Allow', allowHeader);
    res.setHeader('Access-Control-Allow-Methods', allowHeader);
    res.status(204).end();
    return false;
  }

  if (!allowedMethods.includes(method)) {
    res.setHeader('Allow', allowHeader);
    throw new ApiHttpError({
      statusCode: 405,
      errorCode: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${method || 'UNKNOWN'} is not supported on this endpoint.`,
      headers: { Allow: allowHeader },
    });
  }

  return true;
}

export function assertJsonContentType(req: VercelRequestLike): void {
  const rawContentType = req.headers['content-type'];
  const contentType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType) || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiHttpError({
      statusCode: 415,
      errorCode: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Content-Type must be application/json.',
    });
  }
}

export function parseAndBoundJsonBody(req: VercelRequestLike): unknown {
  const contentLengthHeader = req.headers['content-length'];
  const contentLengthStr = Array.isArray(contentLengthHeader)
    ? contentLengthHeader[0]
    : contentLengthHeader;

  if (contentLengthStr) {
    const contentLength = Number(contentLengthStr);
    if (!Number.isNaN(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiHttpError({
        statusCode: 413,
        errorCode: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds the maximum size of ${MAX_REQUEST_BODY_BYTES} bytes.`,
      });
    }
  }

  if (typeof req.body === 'string') {
    const byteLength = Buffer.byteLength(req.body, 'utf8');
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiHttpError({
        statusCode: 413,
        errorCode: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds the maximum size of ${MAX_REQUEST_BODY_BYTES} bytes.`,
      });
    }
    if (req.body.trim().length === 0) {
      throw new ApiHttpError({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: 'Request body cannot be empty.',
      });
    }
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiHttpError({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: 'Malformed JSON in request body.',
      });
    }
  }

  if (req.body === undefined || req.body === null) {
    throw new ApiHttpError({
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      message: 'Missing JSON request body.',
    });
  }

  const serializedSize = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
  if (serializedSize > MAX_REQUEST_BODY_BYTES) {
    throw new ApiHttpError({
      statusCode: 413,
      errorCode: 'PAYLOAD_TOO_LARGE',
      message: `Request body exceeds the maximum size of ${MAX_REQUEST_BODY_BYTES} bytes.`,
    });
  }

  return req.body;
}

export async function authenticateAndRateLimitRequest(
  req: VercelRequestLike,
  operation: RateLimitOperation
): Promise<DecodedAuthToken> {
  const authHeaderRaw = req.headers['authorization'];
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

  if (!authHeader || typeof authHeader !== 'string') {
    throw new ApiHttpError({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Missing Authorization header.',
    });
  }

  const match = /^Bearer\s+(\S+)$/.exec(authHeader.trim());
  if (!match || !match[1]) {
    throw new ApiHttpError({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Malformed Authorization header. Expected Bearer <token>.',
    });
  }

  const idToken = match[1];
  if (idToken.length < 20 || idToken.length > 4096) {
    throw new ApiHttpError({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Invalid authentication credential length.',
    });
  }

  const backend = await getAdminBackend();

  // Verify Firebase App Check when enabled
  if (process.env.ENFORCE_APP_CHECK === 'true') {
    const appCheckRaw = req.headers['x-firebase-appcheck'];
    const appCheckToken = Array.isArray(appCheckRaw) ? appCheckRaw[0] : appCheckRaw;
    if (!appCheckToken || typeof appCheckToken !== 'string' || appCheckToken.trim().length < 10) {
      throw new ApiHttpError({
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
        message: 'Missing or invalid Firebase App Check token.',
      });
    }
    try {
      await withTimeout(backend.verifyAppCheckToken(appCheckToken.trim()), 4000);
    } catch {
      throw new ApiHttpError({
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
        message: 'Firebase App Check verification failed.',
      });
    }
  }

  let decodedToken: DecodedAuthToken;
  try {
    decodedToken = await withTimeout(backend.verifyIdToken(idToken, true), 5000);
  } catch {
    throw new ApiHttpError({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Invalid, expired, or revoked authentication token.',
    });
  }

  if (!decodedToken || typeof decodedToken.uid !== 'string' || decodedToken.uid.trim().length === 0) {
    throw new ApiHttpError({
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Token does not contain a valid user identity.',
    });
  }

  // Enforce verified email ownership for journal mutations unless explicitly disabled
  const requireVerified = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
  const signInProvider = decodedToken.firebase?.sign_in_provider;
  const isFederatedGoogle = signInProvider === 'google.com';

  if (requireVerified && !decodedToken.email_verified && !isFederatedGoogle) {
    throw new ApiHttpError({
      statusCode: 403,
      errorCode: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before saving or modifying journal entries.',
    });
  }

  // Enforce persistent rate limit scoped by IP and authenticated UID
  const clientIp = extractTrustedClientIp(req.headers);
  const rateLimitResult = await withTimeout(
    enforceRateLimit({
      uid: decodedToken.uid,
      clientIp,
      operation,
    }),
    4000
  );

  if (!rateLimitResult.allowed) {
    throw new ApiHttpError({
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
      message: 'Too many requests in a short window. Please wait a moment before trying again.',
      headers: {
        'Retry-After': String(rateLimitResult.retryAfterSeconds),
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetEpochSeconds),
      },
    });
  }

  return decodedToken;
}

export function sendSuccess<T>(
  res: VercelResponseLike,
  statusCode: number,
  data: T,
  requestId: string
): void {
  const payload: ApiSuccessResponse<T> = {
    ok: true,
    data,
    requestId,
  };
  res.status(statusCode).json(payload);
}

export function handleApiError(
  err: unknown,
  req: VercelRequestLike,
  res: VercelResponseLike,
  requestId: string,
  route: string,
  startTimeMs: number,
  uidHash?: string
): void {
  const durationMs = Date.now() - startTimeMs;

  if (err instanceof ApiHttpError) {
    if (err.headers) {
      for (const [k, v] of Object.entries(err.headers)) {
        res.setHeader(k, v);
      }
    }
    logStructuredEvent({
      level: err.statusCode >= 500 ? 'error' : 'warn',
      requestId,
      route,
      method: req.method,
      statusCode: err.statusCode,
      durationMs,
      errorCode: err.errorCode,
      uidHash,
    });
    const body: ApiErrorResponse = {
      ok: false,
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      },
      requestId,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof Error && err.name === 'ConfigurationError') {
    logStructuredEvent({
      level: 'error',
      requestId,
      route,
      method: req.method,
      statusCode: 503,
      durationMs,
      errorCode: 'SERVICE_UNAVAILABLE',
      uidHash,
    });
    const body: ApiErrorResponse = {
      ok: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message:
          'Server security or persistence infrastructure is not configured for this environment.',
      },
      requestId,
    };
    res.status(503).json(body);
    return;
  }

  logStructuredEvent({
    level: 'error',
    requestId,
    route,
    method: req.method,
    statusCode: 500,
    durationMs,
    errorCode: 'INTERNAL_ERROR',
    uidHash,
  });

  const body: ApiErrorResponse = {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred while processing your request.',
    },
    requestId,
  };
  res.status(500).json(body);
}
