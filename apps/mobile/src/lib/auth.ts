import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sentry } from "../monitoring/sentry";

export type CognitoSession = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
};

const STORAGE_KEY = "staffflow.mobile.cognito.session";

function apiRoot() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!value) throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured");
  return value.endsWith("/api") ? value : `${value}/api`;
}

function cognitoEndpoint() {
  const region = process.env.EXPO_PUBLIC_AWS_REGION ?? "ap-south-1";
  return `https://cognito-idp.${region}.amazonaws.com/`;
}

function clientId() {
  const value = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;
  if (!value) throw new Error("EXPO_PUBLIC_COGNITO_CLIENT_ID is not configured");
  return value;
}

async function authApi<T>(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${apiRoot()}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload.error ?? "Authentication request failed"));
    Sentry.captureException(error);
    throw error;
  }
  return payload as T;
}

export async function sendOtp(phoneNumber: string) {
  return authApi<{ session: string; challengeName: string; delivery: string }>("/auth/otp/send", { phoneNumber });
}

export async function verifyOtp(phoneNumber: string, session: string, code: string) {
  const result = await authApi<{ accessToken: string; idToken: string; refreshToken?: string; expiresIn?: number }>("/auth/otp/verify", { phoneNumber, session, code });
  const next: CognitoSession = { accessToken: result.accessToken, idToken: result.idToken, refreshToken: result.refreshToken, expiresAt: Date.now() + Number(result.expiresIn ?? 3600) * 1000 };
  await saveSession(next);
  return next;
}

async function refreshCognitoSession(session: CognitoSession) {
  if (!session.refreshToken) return null;
  const response = await fetch(cognitoEndpoint(), { method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" }, body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: clientId(), AuthParameters: { REFRESH_TOKEN: session.refreshToken } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.AuthenticationResult?.AccessToken || !payload.AuthenticationResult?.IdToken) throw new Error(String(payload.message ?? "Session refresh failed"));
  const result = payload.AuthenticationResult as Record<string, unknown>;
  const refreshed = { accessToken: String(result.AccessToken), idToken: String(result.IdToken), refreshToken: session.refreshToken, expiresAt: Date.now() + Number(result.ExpiresIn ?? 3600) * 1000 } satisfies CognitoSession;
  await saveSession(refreshed);
  return refreshed;
}

export async function readSession() {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as CognitoSession; } catch { return null; }
}

export async function saveSession(session: CognitoSession) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
export async function clearSession() { await AsyncStorage.removeItem(STORAGE_KEY); }

export async function getValidSession() {
  const session = await readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 30_000) return session;
  try { return await refreshCognitoSession(session); } catch { await clearSession(); return null; }
}
