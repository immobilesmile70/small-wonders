import crypto from 'node:crypto';
import {
  entryIdSchema,
  updateEntrySchema,
} from '../../src/schemas/entry';
import { getAdminBackend } from '../_lib/firebaseAdmin';
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

function extractEntryId(req: VercelRequestLike): string {
  const queryId = req.query?.entryId;
  const candidate = Array.isArray(queryId) ? queryId[0] : queryId;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }
  if (req.url) {
    const pathPart = req.url.split('?')[0];
    const segments = pathPart.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment !== 'entries') {
      return decodeURIComponent(lastSegment);
    }
  }
  return '';
}

/**
 * PATCH /api/entries/:entryId — Updates an existing journal entry owned by the authenticated user.
 * DELETE /api/entries/:entryId — Deletes an existing journal entry owned by the authenticated user.
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

    if (!assertMethodAllowed(req, res, ['PATCH', 'DELETE'])) {
      return;
    }

    const method = (req.method || '').toUpperCase();
    const rawEntryId = extractEntryId(req);
    const idValidation = entryIdSchema.safeParse(rawEntryId);

    if (!idValidation.success) {
      throw new ApiHttpError({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid entry identifier format.',
        fieldErrors: {
          entryId: idValidation.error.issues.map((i) => i.message),
        },
      });
    }

    const validEntryId = idValidation.data;

    if (method === 'PATCH') {
      assertJsonContentType(req);
      const rawBody = parseAndBoundJsonBody(req);

      const decodedToken = await authenticateAndRateLimitRequest(req, 'update');
      uidHash = hashUidForAudit(decodedToken.uid);

      const parsed = updateEntrySchema.safeParse(rawBody);
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        throw new ApiHttpError({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: flattened.formErrors[0] || 'Invalid entry update payload.',
          fieldErrors: flattened.fieldErrors,
        });
      }

      const backend = await getAdminBackend();
      const updated = await withTimeout(
        backend.updateEntry(decodedToken.uid, validEntryId, parsed.data),
        8000
      );

      if (!updated) {
        throw new ApiHttpError({
          statusCode: 404,
          errorCode: 'NOT_FOUND',
          message: 'The requested journal entry could not be found.',
        });
      }

      logStructuredEvent({
        level: 'info',
        requestId,
        route: '/api/entries/[entryId]',
        method: 'PATCH',
        statusCode: 200,
        durationMs: Date.now() - startTimeMs,
        uidHash,
      });

      sendSuccess(res, 200, { entry: updated }, requestId);
      return;
    }

    if (method === 'DELETE') {
      const decodedToken = await authenticateAndRateLimitRequest(req, 'delete');
      uidHash = hashUidForAudit(decodedToken.uid);

      const backend = await getAdminBackend();
      const deleted = await withTimeout(
        backend.deleteEntry(decodedToken.uid, validEntryId),
        8000
      );

      if (!deleted) {
        throw new ApiHttpError({
          statusCode: 404,
          errorCode: 'NOT_FOUND',
          message: 'The requested journal entry could not be found.',
        });
      }

      logStructuredEvent({
        level: 'info',
        requestId,
        route: '/api/entries/[entryId]',
        method: 'DELETE',
        statusCode: 200,
        durationMs: Date.now() - startTimeMs,
        uidHash,
      });

      sendSuccess(res, 200, { deletedId: validEntryId }, requestId);
      return;
    }
  } catch (err) {
    handleApiError(err, req, res, requestId, '/api/entries/[entryId]', startTimeMs, uidHash);
  }
}
