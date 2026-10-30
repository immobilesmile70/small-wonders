import crypto from 'node:crypto';
import { deleteAccountSchema } from '../src/schemas/entry';
import { getAdminBackend } from './_lib/firebaseAdmin';
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
} from './_lib/security';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

/**
 * DELETE /api/account
 * Permanently deletes all Firestore journal entries and profile metadata owned by
 * the authenticated user, then deletes the Firebase Authentication account.
 * Never accepts a client-supplied UID.
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

    if (!assertMethodAllowed(req, res, ['DELETE'])) {
      return;
    }

    assertJsonContentType(req);
    const rawBody = parseAndBoundJsonBody(req);

    // Authenticate and apply strict account-deletion rate limit (3 per hour)
    const decodedToken = await authenticateAndRateLimitRequest(req, 'account_delete');
    uidHash = hashUidForAudit(decodedToken.uid);

    const parsed = deleteAccountSchema.safeParse(rawBody);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      throw new ApiHttpError({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: flattened.formErrors[0] || 'Account deletion confirmation is required.',
        fieldErrors: flattened.fieldErrors,
      });
    }

    const backend = await getAdminBackend();
    const { deletedEntriesCount } = await withTimeout(
      backend.deleteUserAccountAndData(decodedToken.uid),
      8500
    );

    logStructuredEvent({
      level: 'info',
      requestId,
      route: '/api/account',
      method: 'DELETE',
      statusCode: 200,
      durationMs: Date.now() - startTimeMs,
      uidHash,
    });

    sendSuccess(
      res,
      200,
      {
        deletedAccount: true,
        deletedEntriesCount,
      },
      requestId
    );
  } catch (err) {
    handleApiError(err, req, res, requestId, '/api/account', startTimeMs, uidHash);
  }
}
