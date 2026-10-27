import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { config } from "../config.js";
import { HttpError } from "./errors.js";
import { ZodError } from "zod";

export type HttpEvent = APIGatewayProxyEventV2;
export type HttpResponse = APIGatewayProxyStructuredResultV2;

export function json(statusCode: number, body: unknown, event?: HttpEvent): HttpResponse {
  const requestedOrigin = event?.headers?.origin ?? event?.headers?.Origin;
  const origin = requestedOrigin && config.corsOrigins.includes(requestedOrigin) ? requestedOrigin : config.corsOrigins[0] ?? "*";
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Authorization,Content-Type,X-Request-Id",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export function parseJsonBody<T>(event: HttpEvent): T {
  if (!event.body) return {} as T;
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function routePath(event: HttpEvent) {
  return (event.rawPath || event.requestContext.http.path || "/").replace(/^\/api(?=\/|$)/, "") || "/";
}

export function pathParam(event: HttpEvent, name: string) {
  return event.pathParameters?.[name];
}

export function method(event: HttpEvent) {
  return event.requestContext.http.method.toUpperCase();
}

export function errorResponse(error: unknown, event: HttpEvent): HttpResponse {
  if (error instanceof HttpError) return json(error.statusCode, { error: error.message, details: error.details }, event);
  if (error instanceof ZodError) return json(400, { error: "Invalid request", details: error.flatten() }, event);
  console.error("Unhandled backend error", error);
  return json(500, { error: "Internal server error" }, event);
}
