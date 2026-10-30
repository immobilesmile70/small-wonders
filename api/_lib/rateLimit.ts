/**
 * Persistent Rate Limiting for Vercel Serverless Functions.
 *
 * Uses Upstash Redis REST API in production so rate counters persist across
 * independent serverless instances and cold starts.
 *
 * Fails closed (503 Service Unavailable) if production rate-limiting credentials
 * are missing, preventing silent downgrade to insecure in-memory state.
 */

export type RateLimitOperation = 'create' | 'update' | 'delete' | 'account_delete' | 'ip_mutation';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  incrementAndCheck: (
    key: string,
    limit: number,
    windowSeconds: number
  ) => Promise<RateLimitResult>;
}

let customRateLimitStoreForTesting: RateLimitStore | null = null;

export function setRateLimitStoreForTesting(store: RateLimitStore | null): void {
  customRateLimitStoreForTesting = store;
}

function getOperationPolicy(op: RateLimitOperation): { limit: number; windowSeconds: number } {
  switch (op) {
    case 'create':
      return {
        limit: Number(process.env.RATE_LIMIT_CREATE_PER_MIN || 12),
        windowSeconds: 60,
      };
    case 'update':
      return {
        limit: Number(process.env.RATE_LIMIT_UPDATE_PER_MIN || 20),
        windowSeconds: 60,
      };
    case 'delete':
      return {
        limit: Number(process.env.RATE_LIMIT_DELETE_PER_MIN || 20),
        windowSeconds: 60,
      };
    case 'account_delete':
      return {
        limit: Number(process.env.RATE_LIMIT_ACCOUNT_DELETE_PER_HOUR || 3),
        windowSeconds: 3600,
      };
    case 'ip_mutation':
      return {
        limit: Number(process.env.RATE_LIMIT_IP_MUTATION_PER_MIN || 30),
        windowSeconds: 60,
      };
  }
}

async function checkUpstashRedisLimit(
  redisUrl: string,
  redisToken: string,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowBucket = Math.floor(nowSeconds / windowSeconds);
  const namespacedKey = `sw:rl:${key}:${windowBucket}`;
  const resetEpochSeconds = (windowBucket + 1) * windowSeconds;
  const retryAfterSeconds = Math.max(1, resetEpochSeconds - nowSeconds);

  const response = await fetch(`${redisUrl.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', namespacedKey],
      ['EXPIRE', namespacedKey, String(windowSeconds + 5)],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis responded with HTTP ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: number; error?: string }>;
  const currentCount = Number(results?.[0]?.result ?? 1);
  const allowed = currentCount <= limit;
  const remaining = Math.max(0, limit - currentCount);

  return {
    allowed,
    limit,
    remaining,
    resetEpochSeconds,
    retryAfterSeconds,
  };
}

/**
 * Extracts client IP safely from Vercel's trusted edge header (`x-vercel-forwarded-for`),
 * avoiding blind trust in arbitrary client-spoofed `x-forwarded-for` headers when not on Vercel.
 */
export function extractTrustedClientIp(headers: Record<string, string | string[] | undefined>): string {
  const vercelForwarded = headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim().length > 0) {
    return vercelForwarded.split(',')[0].trim();
  }
  return 'unknown-ip';
}

export async function enforceRateLimit(params: {
  uid: string;
  clientIp: string;
  operation: RateLimitOperation;
}): Promise<RateLimitResult> {
  const { uid, clientIp, operation } = params;
  const policy = getOperationPolicy(operation);
  const ipPolicy = getOperationPolicy('ip_mutation');

  if (customRateLimitStoreForTesting) {
    const ipCheck = await customRateLimitStoreForTesting.incrementAndCheck(
      `ip:${clientIp}`,
      ipPolicy.limit,
      ipPolicy.windowSeconds
    );
    if (!ipCheck.allowed) {
      return ipCheck;
    }
    return customRateLimitStoreForTesting.incrementAndCheck(
      `uid:${uid}:${operation}`,
      policy.limit,
      policy.windowSeconds
    );
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const isPlaceholder =
    !redisUrl ||
    !redisToken ||
    redisUrl.includes('your-endpoint.upstash.io') ||
    redisToken.includes('PLACEHOLDER');

  if (isPlaceholder) {
    // Fail closed in production or whenever strict rate limiting is required
    const err = new Error(
      'Persistent rate-limiting service (Upstash Redis) is not configured.'
    );
    err.name = 'ConfigurationError';
    throw err;
  }

  const ipCheck = await checkUpstashRedisLimit(
    redisUrl,
    redisToken,
    `ip:${clientIp}`,
    ipPolicy.limit,
    ipPolicy.windowSeconds
  );
  if (!ipCheck.allowed) {
    return ipCheck;
  }

  return checkUpstashRedisLimit(
    redisUrl,
    redisToken,
    `uid:${uid}:${operation}`,
    policy.limit,
    policy.windowSeconds
  );
}
