"use client";

export type CognitoSession = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
};

const STORAGE_KEY = "staffflow.admin.cognito.session";

function cognitoEndpoint() {
  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-south-1";
  return `https://cognito-idp.${region}.amazonaws.com/`;
}

function clientId() {
  const value = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!value) throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  return value;
}

async function cognitoRequest(target: string, body: Record<string, unknown>) {
  const response = await fetch(cognitoEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.message ?? "Cognito request failed"));
  return payload as Record<string, unknown>;
}

function sessionFromAuthResult(result: Record<string, unknown>, previous?: CognitoSession): CognitoSession {
  const authentication = result.AuthenticationResult as Record<string, unknown> | undefined;
  if (!authentication?.AccessToken || !authentication.IdToken) throw new Error("Cognito did not return a complete session");
  return {
    accessToken: String(authentication.AccessToken),
    idToken: String(authentication.IdToken),
    refreshToken: authentication.RefreshToken ? String(authentication.RefreshToken) : previous?.refreshToken,
    expiresAt: Date.now() + Number(authentication.ExpiresIn ?? 3600) * 1000,
  };
}

export async function signInAdmin(username: string, password: string) {
  const result = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId(),
    AuthParameters: { USERNAME: username.trim(), PASSWORD: password },
  });
  if (result.ChallengeName) throw new Error(`Additional Cognito challenge required: ${String(result.ChallengeName)}`);
  const session = sessionFromAuthResult(result);
  saveSession(session);
  return session;
}

export async function requestPasswordReset(username: string) {
  await cognitoRequest("ForgotPassword", { ClientId: clientId(), Username: username.trim() });
}

export async function refreshAdminSession(session: CognitoSession) {
  if (!session.refreshToken) return null;
  const result = await cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: clientId(),
    AuthParameters: { REFRESH_TOKEN: session.refreshToken },
  });
  const refreshed = sessionFromAuthResult(result, session);
  saveSession(refreshed);
  return refreshed;
}

export function readSession() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as CognitoSession : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CognitoSession) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export async function getValidSession() {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 30_000) return session;
  try {
    return await refreshAdminSession(session);
  } catch {
    clearSession();
    return null;
  }
}
