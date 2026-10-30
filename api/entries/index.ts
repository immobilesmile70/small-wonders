import crypto from 'node:crypto';
import {
  CURRENT_SCHEMA_VERSION,
  createEntrySchema,
} from '../../src/schemas/entry';
import {
  generateServerEntryId,
  getAdminBackend,
} from '../_lib/firebaseAdmin';
import {
  ApiHttpError,
  applyStandardSecurityHeaders,
  assertJsonContentType,
  assertMethodAllowed,
  authenticateAndRateLimitRequest,
  handleApiError,
  hashUidForAudit,
  logStructuredEvent,
  parseAndBoundJsonBody,
  sendSuccess,
  validateOriginAndApplyCors,
  withTimeout,
  type VercelRequestLike,
  type VercelResponseLike,
} from '../_lib/security';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

/**
 * POST /api/entries
 * Creates a new journal observation inside the authenticated user's namespace (`users/{uid}/entries/{entryId}`).
 */
export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
): Promise<void> {
  const startTimeMs = Date.now();
  const requestId = crypto.randomUUID();
  let uidHash: string | undefined;

  applyStandardSecurityHeaders(res, requestId);

  try {
    validateOriginAndApplyCors(req, res);

    if (!assertMethodAllowed(req, res, ['POST'])) {
      return;
    }

    assertJsonContentType(req);
    const rawBody = parseAndBoundJsonBody(req);

    // Authenticate and rate-limit BEFORE database access
    const decodedToken = await authenticateAndRateLimitRequest(req, 'create');
    uidHash = hashUidForAudit(decodedToken.uid);

    // Validate request payload with strict schema (rejects unknown fields such as `uid` or `createdAt`)
    const parsed = createEntrySchema.safeParse(rawBody);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      throw new ApiHttpError({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: flattened.formErrors[0] || 'One or more fields failed validation.',
        fieldErrors: flattened.fieldErrors,
      });
    }

    const nowIso = new Date().toISOString();
    const entryId = generateServerEntryId();
    const backend = await getAdminBackend();

    const createdEntry = await withTimeout(
      backend.createEntry(decodedToken.uid, entryId, {
        title: parsed.data.title,
        note: parsed.data.note,
        category: parsed.data.category,
        tags: parsed.data.tags,
        observedAt: parsed.data.observedAt,
        placeLabel: parsed.data.placeLabel ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      }),
      8000
    );

    logStructuredEvent({
      level: 'info',
      requestId,
      route: '/api/entries',
      method: 'POST',
      statusCode: 201,
      durationMs: Date.now() - startTimeMs,
      uidHash,
    });

    sendSuccess(res, 201, { entry: createdEntry }, requestId);
  } catch (err) {
    handleApiError(err, req, res, requestId, '/api/entries', startTimeMs, uidHash);
  }
}
