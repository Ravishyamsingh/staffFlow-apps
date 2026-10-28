import { clearSession, getValidSession, readSession, saveSession, type CognitoSession } from "./auth";
import { Sentry } from "../monitoring/sentry";

type ApiRequestInit = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) { super(message); this.name = "ApiError"; this.status = status; this.details = details; }
}

function apiRoot() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!value) throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured");
  return value.endsWith("/api") ? value : `${value}/api`;
}

async function requestWithToken<T>(path: string, session: CognitoSession, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.idToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiRoot()}${path.startsWith("/") ? path : `/${path}`}`, { ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(String(payload?.error ?? `API request failed (${response.status})`), response.status, payload?.details);
  return payload as T;
}

export async function apiRequest<T>(path: string, options: ApiRequestInit = {}) {
  let session = await getValidSession();
  if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
  const requestOptions = { ...options, body: options.body === undefined ? undefined : JSON.stringify(options.body) };
  try {
    return await requestWithToken<T>(path, session, requestOptions);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const original = await readSession();
    if (!original?.refreshToken) { Sentry.captureException(error); await clearSession(); throw error; }
    const refreshed = await refreshSessionFromCognito(original);
    if (!refreshed) { Sentry.captureException(error); await clearSession(); throw error; }
    session = refreshed;
    try {
      return await requestWithToken<T>(path, session, requestOptions);
    } catch (retryError) {
      Sentry.captureException(retryError);
      throw retryError;
    }
  }
}

async function refreshSessionFromCognito(session: CognitoSession) {
  const region = process.env.EXPO_PUBLIC_AWS_REGION ?? "ap-south-1";
  const clientId = session.clientId ?? process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;
  if (!clientId || !session.refreshToken) return null;
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, { method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" }, body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: clientId, AuthParameters: { REFRESH_TOKEN: session.refreshToken } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.AuthenticationResult?.AccessToken || !payload.AuthenticationResult?.IdToken) return null;
  const result = payload.AuthenticationResult as Record<string, unknown>;
  const refreshed = { accessToken: String(result.AccessToken), idToken: String(result.IdToken), refreshToken: session.refreshToken, expiresAt: Date.now() + Number(result.ExpiresIn ?? 3600) * 1000 } satisfies CognitoSession;
  await saveSession(refreshed);
  return refreshed;
}
