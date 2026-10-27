import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { config } from "../config.js";
import { getAuthContext, canAccessOwnerData, canManageAll, canManagePartners, canManageSettings, hasRole, requireRole } from "../auth/claims.js";
import { errorResponse, json, method, parseJsonBody, pathParam, routePath } from "../lib/http.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { deleteItem, getItem, putItem, scanItems } from "../lib/db.js";
import { keys, normalizeKey } from "../lib/keys.js";
import { createRequest, getParseLog, getPartner, getRequest, getScoreConfig, listEntities, listPartners, listRequests, replaceRequestBookings, saveParseLog, savePartner, saveScoreConfig, updateRequest } from "../lib/repository.js";
import { rankPartners } from "../services/matching.js";
import { BookingSchema, parseRequestText } from "../services/parser.js";
import { createDownloadUrl, createUploadUrl } from "../services/s3.js";
import { broadcastRequestEvent } from "../services/realtime.js";
import type { AuthContext, Partner, RequestRecord, ScoreConfig } from "../types.js";
import { DEFAULT_SCORE_CONFIG } from "../types.js";

const RequestBodySchema = z.object({ rawInput: z.string().trim().min(1).max(4000) });
const ConfirmBodySchema = z.object({ partnerId: z.string().trim().min(1).optional(), partnerName: z.string().trim().min(1).optional(), assignments: z.record(z.string().trim().min(1)).optional() }).refine((value) => Boolean(value.partnerId || value.assignments && Object.keys(value.assignments).length), "partnerId or assignments is required");
const PartnerSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2).max(120),
  role: z.enum(["chef", "waiter", "cleaner", "helper", "other"]),
  subcategories: z.array(z.string().min(1)).min(1),
  area: z.string().min(1).max(120),
  distanceKm: z.number().min(0).max(100).default(0),
  reliability: z.number().min(0).max(5).default(0),
  shiftsCompleted: z.number().int().min(0).default(0),
  availability: z.array(z.string()).default([]),
  verified: z.boolean().default(false),
  ownerUserId: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
});
const ScoreConfigSchema = z.object({
  subcategoryFit: z.number().min(0).max(1),
  distanceFit: z.number().min(0).max(1),
  availabilityFit: z.number().min(0).max(1),
  reliabilityFit: z.number().min(0).max(1),
}).refine((value) => Math.abs(Object.values(value).reduce((sum, current) => sum + current, 0) - 1) < 0.001, "Weights must add up to 1");

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (method(event) === "OPTIONS") return json(204, null, event);
    const path = routePath(event);
    if (method(event) === "GET" && path === "/health") return json(200, { ok: true, service: "staffflow-api", region: config.region }, event);
    const context = getAuthContext(event);
    const body = parseJsonBody<Record<string, unknown>>(event);
    const result = await dispatch(method(event), path, event, context, body);
    return json(200, result, event);
  } catch (error) {
    return errorResponse(error, event);
  }
};

async function dispatch(httpMethod: string, path: string, event: Parameters<APIGatewayProxyHandlerV2>[0], context: AuthContext, body: Record<string, unknown>) {
  const segments = path.split("/").filter(Boolean);

  if (segments[0] === "me" && httpMethod === "GET") return { user: publicAuthContext(context) };

  if (segments[0] === "requests") return requestRoutes(httpMethod, segments.slice(1), event, context, body);
  if (segments[0] === "partners") return partnerRoutes(httpMethod, segments.slice(1), event, context, body);
  if (segments[0] === "subcategories") return resourceRoutes("SUBCATEGORY", "SUBCAT", httpMethod, segments.slice(1), event, context, body);
  if (segments[0] === "locations") return resourceRoutes("LOCATION", "LOCATION", httpMethod, segments.slice(1), event, context, body);
  if (segments[0] === "parse-logs") return parseLogRoutes(httpMethod, segments.slice(1), context);
  if (segments[0] === "scoring") return scoringRoutes(httpMethod, segments.slice(1), event, context, body);
  if (segments[0] === "dashboard") return dashboardRoutes(httpMethod, segments.slice(1), context);
  if (segments[0] === "storage") return storageRoutes(httpMethod, segments.slice(1), context, body);
  throw notFound("API route not found");
}

async function requestRoutes(httpMethod: string, segments: string[], event: Parameters<APIGatewayProxyHandlerV2>[0], context: AuthContext, body: Record<string, unknown>) {
  if (httpMethod === "POST" && segments.length === 0) {
    requireRole(context, "owner", "admin", "operation");
    const input = RequestBodySchema.parse(body);
    const parsed = await parseRequestText(input.rawInput);
    const now = new Date().toISOString();
    const request: RequestRecord = {
      id: `REQ-${randomUUID().slice(0, 8).toUpperCase()}`,
      ownerId: context.sub,
      ownerEmail: context.email,
      ownerPhone: context.phoneNumber,
      restaurantId: stringValue(context.claims["custom:restaurantId"]),
      rawInput: input.rawInput,
      status: parsed.result.followUpQuestions.length ? "parsed" : "reviewed",
      bookings: parsed.result.bookings,
      followUpQuestions: parsed.result.followUpQuestions,
      uncertainFields: parsed.result.bookings.reduce((total, booking) => total + Object.values(booking.confidence).filter((confidence) => confidence < 0.75).length, 0),
      createdAt: now,
      updatedAt: now,
    };
    await createRequest(request);
    await saveParseLog(request.id, { provider: parsed.provider, rawOutput: parsed.rawOutput, parsedAt: now, confidence: request.bookings.map((booking) => booking.confidence) });
    await broadcastRequestEvent("request.created", request);
    return request;
  }

  if (httpMethod === "GET" && segments.length === 0) {
    const query = event.queryStringParameters ?? {};
    const ownerId = hasRole(context, "owner") && !canManageAll(context) ? context.sub : undefined;
    const partnerId = hasRole(context, "partner") && !canManageAll(context) ? context.sub : undefined;
    if (!ownerId && !partnerId && !canManageAll(context)) throw forbidden();
    const requests = await listRequests({ ownerId, partnerId, status: query.status, date: query.date, limit: parseLimit(query.limit) });
    return { requests };
  }

  const requestId = segments[0];
  if (!requestId) throw notFound("Request ID is required");
  const request = await getRequest(requestId);
  if (!request) throw notFound("Request not found");
  if (!canAccessOwnerData(context, request.ownerId) && !(hasRole(context, "partner") && request.selectedPartnerId === context.sub)) throw forbidden();

  if (httpMethod === "GET" && segments.length === 1) return request;
  if (httpMethod === "PUT" && segments[1] === "confirm") {
    requireRole(context, "owner", "admin", "operation");
    const input = ConfirmBodySchema.parse(body);
    if (request.status === "cancelled" || request.status === "completed") throw badRequest(`A ${request.status} request cannot be confirmed`);
    if (request.uncertainFields > 0 || request.followUpQuestions.length > 0) throw badRequest("Resolve all uncertain booking fields before confirmation");
    const assignmentIds = input.assignments ?? Object.fromEntries(request.bookings.map((booking) => [booking.id, input.partnerId]));
    const partners = new Map<string, Partner>();
    for (const partnerId of Object.values(assignmentIds)) {
      if (!partnerId) throw badRequest("Every booking must have a partner assignment");
      const partner = await getPartner(partnerId);
      if (!partner) throw notFound(`Partner not found: ${partnerId}`);
      partners.set(partner.id, partner);
    }
    for (const booking of request.bookings) {
      const partnerId = assignmentIds[booking.id];
      const partner = partnerId ? partners.get(partnerId) : undefined;
      if (!partner || (partner.role !== booking.role && partner.role !== "other")) throw badRequest(`Partner does not match booking ${booking.id}`);
    }
    const selectedPartners = Object.fromEntries(request.bookings.map((booking) => {
      const partnerId = assignmentIds[booking.id];
      const partner = partnerId ? partners.get(partnerId) : undefined;
      if (!partner) throw badRequest(`Every booking must have a partner assignment: ${booking.id}`);
      return [booking.id, { id: partner.id, name: partner.name }];
    }));
    const firstBooking = request.bookings[0];
    const firstPartnerId = firstBooking ? assignmentIds[firstBooking.id] : undefined;
    const firstPartner = firstPartnerId ? partners.get(firstPartnerId) : undefined;
    if (!firstPartner) throw badRequest("At least one booking assignment is required");
    const updated = await updateRequest(requestId, { status: "confirmed", selectedPartnerId: firstPartner.id, selectedPartnerName: input.partnerName ?? firstPartner.name, selectedPartners });
    if (updated) await broadcastRequestEvent("request.confirmed", updated);
    return updated;
  }
  if (httpMethod === "PUT" && segments[1] === "cancel") {
    requireRole(context, "owner", "admin", "operation");
    if (request.status === "completed") throw badRequest("A completed request cannot be cancelled");
    const updated = await updateRequest(requestId, { status: "cancelled", cancelledAt: new Date().toISOString() });
    if (updated) await broadcastRequestEvent("request.cancelled", updated);
    return updated;
  }
  if (httpMethod === "PUT" && segments[1] === "complete") {
    requireRole(context, "admin", "operation");
    if (request.status === "cancelled") throw badRequest("A cancelled request cannot be completed");
    const updated = await updateRequest(requestId, { status: "completed" });
    if (updated) await broadcastRequestEvent("request.completed", updated);
    return updated;
  }
  if (httpMethod === "POST" && segments[1] === "parse") {
    requireRole(context, "owner", "admin", "operation");
    const parsed = await parseRequestText(request.rawInput);
    await replaceRequestBookings(requestId, parsed.result.bookings);
    const updated = await updateRequest(requestId, {
      bookings: parsed.result.bookings,
      followUpQuestions: parsed.result.followUpQuestions,
      uncertainFields: parsed.result.bookings.reduce((total, booking) => total + Object.values(booking.confidence).filter((confidence) => confidence < 0.75).length, 0),
      status: parsed.result.followUpQuestions.length ? "parsed" : "reviewed",
    });
    if (!updated) throw notFound("Request not found after parsing");
    await saveParseLog(requestId, { provider: parsed.provider, rawOutput: parsed.rawOutput, parsedAt: new Date().toISOString(), confidence: parsed.result.bookings.map((booking) => booking.confidence) });
    await broadcastRequestEvent("request.parsed", updated);
    return updated;
  }
  if (httpMethod === "GET" && segments[1] === "matches") {
    requireRole(context, "owner", "admin", "operation");
    const partners = await listPartners();
    const scoring = await getScoreConfig() ?? DEFAULT_SCORE_CONFIG;
    const groups = request.bookings.map((booking) => ({ bookingId: booking.id, matches: rankPartners(booking, partners, scoring) }));
    return { groups, matches: groups.flatMap((group) => group.matches) };
  }
  if (httpMethod === "PUT" && segments[1] === "assign") {
    requireRole(context, "admin", "operation");
    const partnerId = stringValue(body.partnerId);
    if (!partnerId) throw badRequest("partnerId is required");
    const partner = await getPartner(partnerId);
    if (!partner) throw notFound("Partner not found");
    const updated = await updateRequest(requestId, { status: "matched", selectedPartnerId: partner.id, selectedPartnerName: partner.name });
    if (updated) await broadcastRequestEvent("request.assigned", updated);
    return updated;
  }
  if ((httpMethod === "PUT" || httpMethod === "PATCH") && segments.length === 1) {
    if (!hasRole(context, "owner", "admin", "operation")) throw forbidden();
    const changes = z.object({ bookings: z.array(BookingSchema).max(20).optional(), followUpQuestions: z.array(z.string()).max(20).optional(), status: z.enum(["parsed", "reviewed"]).optional() }).parse(body);
    if (changes.bookings) await replaceRequestBookings(requestId, changes.bookings as RequestRecord["bookings"]);
    const uncertainFields = changes.bookings
      ? changes.bookings.reduce((total, booking) => total + Object.values(booking.confidence).filter((confidence) => confidence < 0.75).length, 0)
      : undefined;
    const updated = await updateRequest(requestId, { ...changes, ...(uncertainFields === undefined ? {} : { uncertainFields }) } as Partial<RequestRecord>);
    const response = updated ?? request;
    await broadcastRequestEvent("request.updated", response);
    return response;
  }
  throw notFound("Request action not found");
}

async function partnerRoutes(httpMethod: string, segments: string[], event: Parameters<APIGatewayProxyHandlerV2>[0], context: AuthContext, body: Record<string, unknown>) {
  if (httpMethod === "GET" && segments.length === 0) {
    if (hasRole(context, "partner") && !canManageAll(context)) {
      const ownPartner = await getPartner(context.sub);
      return { partners: ownPartner ? [ownPartner] : [] };
    }
    if (!hasRole(context, "owner", "admin", "operation")) throw forbidden();
    const query = event.queryStringParameters ?? {};
    const partners = await listPartners();
    return { partners: partners.filter((partner) => (!query.role || partner.role === query.role) && (!query.subcategory || partner.subcategories.includes(query.subcategory))) };
  }
  if (httpMethod === "POST" && segments.length === 0) {
    if (!canManagePartners(context)) throw forbidden();
    const partner = PartnerSchema.parse(body);
    const created = { ...partner, id: partner.id ?? `PARTNER-${randomUUID().slice(0, 8).toUpperCase()}` } as Partner;
    await savePartner(created);
    return created;
  }
  const partnerId = segments[0];
  if (!partnerId) throw notFound("Partner ID is required");
  const existing = await getPartner(partnerId);
  if (!existing) throw notFound("Partner not found");
  if (httpMethod === "GET") {
    if (!hasRole(context, "owner", "admin", "operation") && !(hasRole(context, "partner") && existing.ownerUserId === context.sub)) throw forbidden();
    return existing;
  }
  if (httpMethod === "PUT" || httpMethod === "PATCH") {
    if (!canManagePartners(context) && !(hasRole(context, "partner") && existing.ownerUserId === context.sub)) throw forbidden();
    const updated = PartnerSchema.partial().parse(body);
    const next = { ...existing, ...updated, id: partnerId } as Partner;
    await savePartner(next);
    return next;
  }
  if (httpMethod === "DELETE") {
    requireRole(context, "admin");
    await deleteItem(keys.partner(partnerId));
    return { deleted: true, id: partnerId };
  }
  throw notFound("Partner action not found");
}

async function resourceRoutes(entityType: "SUBCATEGORY" | "LOCATION", prefix: "SUBCAT" | "LOCATION", httpMethod: string, segments: string[], _event: Parameters<APIGatewayProxyHandlerV2>[0], context: AuthContext, body: Record<string, unknown>) {
  if (httpMethod === "GET" && segments.length === 0) return { items: await listEntities(entityType) };
  if (httpMethod === "POST" && segments.length === 0) {
    requireRole(context, "admin", "operation");
    const name = stringValue(body.name);
    if (!name) throw badRequest("name is required");
    const id = stringValue(body.id) ?? normalizeKey(name);
    const item = { ...keys[entityType === "SUBCATEGORY" ? "subcategory" : "location"](id), entityType, id, name, ...body };
    await putItem(item);
    return item;
  }
  const id = segments[0];
  if (!id) throw notFound("Resource ID is required");
  if (httpMethod === "PUT" || httpMethod === "PATCH") {
    requireRole(context, "admin", "operation");
    const existing = await getItem<Record<string, unknown>>(keys[entityType === "SUBCATEGORY" ? "subcategory" : "location"](id));
    if (!existing) throw notFound("Resource not found");
    const name = stringValue(body.name) ?? stringValue(existing.name);
    if (!name) throw badRequest("name is required");
    const item = { ...existing, ...body, ...keys[entityType === "SUBCATEGORY" ? "subcategory" : "location"](id), entityType, id, name };
    await putItem(item);
    return item;
  }
  if (httpMethod === "DELETE") {
    requireRole(context, "admin");
    await deleteItem({ PK: `${prefix}#${id}`, SK: "DETAIL" });
    return { deleted: true, id };
  }
  throw notFound("Resource action not found");
}

async function parseLogRoutes(httpMethod: string, segments: string[], context: AuthContext) {
  requireRole(context, "admin", "operation");
  if (httpMethod !== "GET") throw notFound("Parse log action not found");
  if (segments[0]) {
    const log = await getParseLog(segments[0]);
    if (!log) throw notFound("Parse log not found");
    return { log };
  }
  const items = await scanItems<Record<string, unknown>>({ TableName: config.tableName, FilterExpression: "entityType = :type", ExpressionAttributeValues: { ":type": "PARSE_LOG" } });
  return { logs: items.map(({ PK: _pk, SK: _sk, entityType: _type, ...item }) => item) };
}

async function scoringRoutes(httpMethod: string, segments: string[], _event: Parameters<APIGatewayProxyHandlerV2>[0], context: AuthContext, body: Record<string, unknown>) {
  if (segments[0] === "preview" && httpMethod === "POST") {
    requireRole(context, "admin", "operation");
    const input = z.object({ booking: BookingSchema, config: ScoreConfigSchema.optional() }).parse(body);
    const partners = await listPartners();
    return { matches: rankPartners(input.booking, partners, input.config ?? await getScoreConfig() ?? DEFAULT_SCORE_CONFIG) };
  }
  if (segments[0] !== "config") throw notFound("Scoring route not found");
  if (httpMethod === "GET") return { config: await getScoreConfig() ?? DEFAULT_SCORE_CONFIG };
  if (httpMethod === "PUT" || httpMethod === "PATCH") {
    requireRole(context, "admin");
    const scoreConfig = ScoreConfigSchema.parse(body) as ScoreConfig;
    return { config: await saveScoreConfig(scoreConfig) };
  }
  throw notFound("Scoring action not found");
}

async function dashboardRoutes(httpMethod: string, segments: string[], context: AuthContext) {
  requireRole(context, "admin", "operation");
  if (httpMethod !== "GET") throw notFound("Dashboard action not found");
  const requests = await listRequests({ limit: 1000 });
  if (segments[0] === "stats" || !segments[0]) {
    const byStatus = requests.reduce<Record<string, number>>((summary, request) => ({ ...summary, [request.status]: (summary[request.status] ?? 0) + 1 }), {});
    return { total: requests.length, byStatus, pendingReview: requests.filter((request) => request.uncertainFields > 0).length };
  }
  if (segments[0] === "heatmap") {
    const partners = await listPartners();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const heatmap = days.map((day) => ({ day, total: partners.length, available: partners.filter((partner) => partner.availability.includes(day)).length, areas: partners.reduce<Record<string, number>>((areas, partner) => {
      if (partner.availability.includes(day)) areas[partner.area] = (areas[partner.area] ?? 0) + 1;
      return areas;
    }, {}) }));
    return { heatmap };
  }
  throw notFound("Dashboard route not found");
}

async function storageRoutes(httpMethod: string, segments: string[], context: AuthContext, body: Record<string, unknown>) {
  if (httpMethod !== "POST") throw notFound("Storage action not found");
  if (segments[0] === "presign-upload") {
    const key = stringValue(body.key);
    const contentType = stringValue(body.contentType);
    if (!key || !contentType) throw badRequest("key and contentType are required");
    return createUploadUrl({ key, contentType, ownerId: context.sub });
  }
  if (segments[0] === "presign-download") {
    const key = stringValue(body.key);
    if (!key) throw badRequest("key is required");
    if (!canManageAll(context) && !key.startsWith(`owners/${context.sub}/`)) throw forbidden("You can only download files belonging to your account");
    return createDownloadUrl(key);
  }
  throw notFound("Storage route not found");
}

function publicAuthContext(context: AuthContext) {
  return { sub: context.sub, username: context.username, email: context.email, phoneNumber: context.phoneNumber, groups: context.groups, restaurantId: context.claims["custom:restaurantId"] };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseLimit(value: string | undefined) {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw badRequest("limit must be a positive integer");
  return Math.min(parsed, 1000);
}
