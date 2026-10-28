import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Sentry } from "../monitoring/sentry";

WebBrowser.maybeCompleteAuthSession();

export type CognitoSession = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  clientId?: string;
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

function oauthClientId() {
  return process.env.EXPO_PUBLIC_COGNITO_OAUTH_CLIENT_ID?.trim() || clientId();
}

function cognitoOAuthConfig() {
  const domain = process.env.EXPO_PUBLIC_COGNITO_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) throw new Error("Google sign-in is not configured. Add EXPO_PUBLIC_COGNITO_DOMAIN in the mobile production environment.");
  const baseUrl = `https://${domain}`;
  return {
    authorizationEndpoint: `${baseUrl}/oauth2/authorize`,
    tokenEndpoint: `${baseUrl}/oauth2/token`,
  } as const;
}

async function authApi<T>(path: string, body: Record<string, unknown>) {
  const url = `${apiRoot()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "otp");
      scope.setContext("auth.request", { method: "POST", path });
      Sentry.captureException(error);
    });
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload.error ?? payload.message ?? `Authentication request failed (${response.status})`));
    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "otp");
      scope.setTag("auth.status", String(response.status));
      scope.setContext("auth.request", { method: "POST", path, status: response.status, response: payload });
      Sentry.captureException(error);
    });
    throw error;
  }
  return payload as T;
}

export async function sendOtp(phoneNumber: string) {
  return authApi<{ session: string; challengeName: string; delivery: string }>("/auth/otp/send", { phoneNumber });
}

export async function verifyOtp(phoneNumber: string, session: string, code: string) {
  const result = await authApi<{ accessToken: string; idToken: string; refreshToken?: string; expiresIn?: number }>("/auth/otp/verify", { phoneNumber, session, code });
  const next: CognitoSession = { accessToken: result.accessToken, idToken: result.idToken, refreshToken: result.refreshToken, expiresAt: Date.now() + Number(result.expiresIn ?? 3600) * 1000, clientId: clientId() };
  await saveSession(next);
  return next;
}

export async function signInWithGoogle() {
  try {
    const discovery = cognitoOAuthConfig();
    const oauthId = oauthClientId();
    const redirectUri = AuthSession.makeRedirectUri({ scheme: "staffflow", path: "oauth/callback" });
    const request = await AuthSession.loadAsync({
      clientId: oauthId,
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      scopes: ["openid", "email", "profile"],
      usePKCE: true,
      extraParams: { identity_provider: "Google" },
    }, discovery);
    const result = await request.promptAsync(discovery);
    if (result.type === "cancel" || result.type === "dismiss") return null;
    if (result.type !== "success" || !result.params.code) {
      throw new Error(result.type === "error" ? result.error?.message ?? "Google sign-in was not completed" : "Google sign-in was not completed");
    }
    const token = await AuthSession.exchangeCodeAsync({
      clientId: oauthId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    }, discovery);
    if (!token.idToken) throw new Error("Google sign-in did not return a Cognito identity token");
    const next: CognitoSession = {
      accessToken: token.accessToken,
      idToken: token.idToken,
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + Number(token.expiresIn ?? 3600) * 1000,
      clientId: oauthId,
    };
    await saveSession(next);
    return next;
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "google");
      scope.setContext("auth.request", { provider: "Google", cognitoHostedUi: true });
      Sentry.captureException(error);
    });
    throw error;
  }
}

async function refreshCognitoSession(session: CognitoSession) {
  if (!session.refreshToken) return null;
  const response = await fetch(cognitoEndpoint(), { method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" }, body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: session.clientId ?? clientId(), AuthParameters: { REFRESH_TOKEN: session.refreshToken } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.AuthenticationResult?.AccessToken || !payload.AuthenticationResult?.IdToken) throw new Error(String(payload.message ?? "Session refresh failed"));
  const result = payload.AuthenticationResult as Record<string, unknown>;
  const refreshed = { accessToken: String(result.AccessToken), idToken: String(result.IdToken), refreshToken: session.refreshToken, clientId: session.clientId ?? clientId(), expiresAt: Date.now() + Number(result.ExpiresIn ?? 3600) * 1000 } satisfies CognitoSession;
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
