import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, unauthorized } from "../lib/errors.js";
import type { AuthContext, UserRole } from "../types.js";

const knownRoles: UserRole[] = ["admin", "operation", "owner", "partner"];

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseGroups(value: unknown): UserRole[] {
  if (Array.isArray(value)) return value.filter((role): role is UserRole => knownRoles.includes(role as UserRole));
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((role): role is UserRole => knownRoles.includes(role as UserRole));
  } catch {
    // Cognito/API Gateway commonly emits groups as a comma-separated claim.
  }
  return value.split(/[ ,]+/).map((role) => role.replace(/[\[\]"']/g, "")).filter((role): role is UserRole => knownRoles.includes(role as UserRole));
}

export function getAuthContext(event: APIGatewayProxyEventV2): AuthContext {
  const requestContext = event.requestContext as unknown as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } };
  const claims = requestContext.authorizer?.jwt?.claims ?? {};
  const sub = asString(claims.sub);
  if (!sub) throw unauthorized();
  return {
    sub,
    username: asString(claims.username),
    email: asString(claims.email),
    phoneNumber: asString(claims.phone_number),
    groups: parseGroups(claims["cognito:groups"]),
    claims,
  };
}

export function hasRole(context: AuthContext, ...roles: UserRole[]) {
  return roles.some((role) => context.groups.includes(role));
}

export function requireRole(context: AuthContext, ...roles: UserRole[]) {
  if (!hasRole(context, ...roles)) throw forbidden(`Required role: ${roles.join(" or ")}`);
}

export function canManageAll(context: AuthContext) {
  return hasRole(context, "admin", "operation");
}

export function canManagePartners(context: AuthContext) {
  return hasRole(context, "admin", "operation");
}

export function canManageSettings(context: AuthContext) {
  return hasRole(context, "admin");
}

export function canAccessOwnerData(context: AuthContext, ownerId: string) {
  return canManageAll(context) || (hasRole(context, "owner") && context.sub === ownerId);
}
