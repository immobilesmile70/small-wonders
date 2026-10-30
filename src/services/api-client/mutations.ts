import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  CreateEntryInput,
  JournalEntry,
  UpdateEntryInput,
} from '../../types/journal';
import { getOptionalAppCheckHeaderToken } from '../firebase/client';

export class MutationClientError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorResponse['error']['code'];
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly requestId?: string;
  public readonly retryAfterSeconds?: number;

  constructor(params: {
    statusCode: number;
    code: ApiErrorResponse['error']['code'];
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'MutationClientError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.fieldErrors = params.fieldErrors;
    this.requestId = params.requestId;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

export function mapApiErrorToUserMessage(
  code: ApiErrorResponse['error']['code'],
  fallbackMessage: string,
  retryAfterSeconds?: number
): string {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again to continue.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Please verify your email address before saving changes to your journal.';
    case 'RATE_LIMITED':
      return retryAfterSeconds
        ? `You have made several changes quickly. Please wait ${retryAfterSeconds} seconds and try again.`
        : 'You have made several changes quickly. Please wait a moment and try again.';
    case 'PAYLOAD_TOO_LARGE':
      return 'This observation is larger than the 16 KB limit. Please shorten your note.';
    case 'NOT_FOUND':
      return 'This observation could not be found. It may have already been removed.';
    case 'VALIDATION_ERROR':
      return fallbackMessage || 'Please review the highlighted fields and try again.';
    case 'SERVICE_UNAVAILABLE':
      return 'The journal service is temporarily unavailable. Your draft is still in the editor.';
    default:
      return fallbackMessage || 'Unable to complete the request right now. Please try again.';
  }
}

async function requestMutationApi<T>(params: {
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  idToken: string;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const { path, method, idToken, body, signal } = params;
  const appCheckToken = await getOptionalAppCheckHeaderToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new MutationClientError({
      statusCode: 0,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Network connection interrupted. Please check your connection and try again.',
    });
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  let jsonPayload: ApiSuccessResponse<T> | ApiErrorResponse | null = null;
  try {
    jsonPayload = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;
  } catch {
    jsonPayload = null;
  }

  if (!response.ok || !jsonPayload || !jsonPayload.ok) {
    const errorCode =
      jsonPayload && !jsonPayload.ok ? jsonPayload.error.code : 'INTERNAL_ERROR';
    const serverMessage =
      jsonPayload && !jsonPayload.ok
        ? jsonPayload.error.message
        : `Request failed with status ${response.status}.`;
    const fieldErrors =
      jsonPayload && !jsonPayload.ok ? jsonPayload.error.fieldErrors : undefined;
    const requestId = jsonPayload?.requestId;

    throw new MutationClientError({
      statusCode: response.status,
      code: errorCode,
      message: mapApiErrorToUserMessage(errorCode, serverMessage, retryAfterSeconds),
      fieldErrors,
      requestId,
      retryAfterSeconds,
    });
  }

  return jsonPayload.data;
}

export async function createEntryViaApi(
  idToken: string,
  input: CreateEntryInput,
  signal?: AbortSignal
): Promise<JournalEntry> {
  const data = await requestMutationApi<{ entry: JournalEntry }>({
    path: '/api/entries',
    method: 'POST',
    idToken,
    body: input,
    signal,
  });
  return data.entry;
}

export async function updateEntryViaApi(
  idToken: string,
  entryId: string,
  input: UpdateEntryInput,
  signal?: AbortSignal
): Promise<JournalEntry> {
  const encodedId = encodeURIComponent(entryId);
  const data = await requestMutationApi<{ entry: JournalEntry }>({
    path: `/api/entries/${encodedId}`,
    method: 'PATCH',
    idToken,
    body: input,
    signal,
  });
  return data.entry;
}

export async function deleteEntryViaApi(
  idToken: string,
  entryId: string,
  signal?: AbortSignal
): Promise<{ deletedId: string }> {
  const encodedId = encodeURIComponent(entryId);
  return requestMutationApi<{ deletedId: string }>({
    path: `/api/entries/${encodedId}`,
    method: 'DELETE',
    idToken,
    signal,
  });
}

export async function deleteAccountViaApi(
  idToken: string,
  confirmationText: string,
  signal?: AbortSignal
): Promise<{ deletedAccount: boolean; deletedEntriesCount: number }> {
  return requestMutationApi<{ deletedAccount: boolean; deletedEntriesCount: number }>({
    path: '/api/account',
    method: 'DELETE',
    idToken,
    body: { confirmationText },
    signal,
  });
}
