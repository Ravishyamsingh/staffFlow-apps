"use client";

import { clearSession, getValidSession, refreshAdminSession, readSession, type CognitoSession } from "./auth";
import { useCallback, useEffect, useState } from "react";

export type ApiRequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function apiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  return value.endsWith("/api") ? value : `${value}/api`;
}

async function requestWithToken<T>(path: string, session: CognitoSession, options: ApiRequestOptions) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.idToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(String(payload?.error ?? `API request failed (${response.status})`), response.status, payload?.details);
  return payload as T;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  let session = await getValidSession();
  if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
  try {
    return await requestWithToken<T>(path, session, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const original = readSession();
    if (!original?.refreshToken) {
      clearSession();
      throw error;
    }
    session = await refreshAdminSession(original);
    if (!session) {
      clearSession();
      throw error;
    }
    return requestWithToken<T>(path, session, options);
  }
}

export function useApiQuery<T>(path: string) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<T>(path).then((value) => {
      if (active) { setData(value); setError(undefined); setLoading(false); }
    }).catch((reason: unknown) => {
      if (active) { setError(reason instanceof Error ? reason : new Error("Request failed")); setLoading(false); }
    });
    return () => { active = false; };
  }, [path, version]);

  return { data, loading, error, reload };
}
