import { config } from "../config.js";
import { batchWrite, getItem, putItem, queryItems, scanItems, transactWrite, updateItem } from "./db.js";
import { keys, normalizeKey } from "./keys.js";
import type { Partner, PartnerMatch, RequestRecord, ScoreConfig, StoredBooking, StoredParseLog, StoredPartner, StoredRequestDetail } from "../types.js";

function requestItem(request: RequestRecord): StoredRequestDetail {
  const date = request.bookings.find((booking) => booking.date)?.date;
  const firstBooking = request.bookings[0];
  const ownerKey = keys.ownerRequest(request.ownerId, request.createdAt, request.id);
  return {
    ...request,
    ...keys.request(request.id),
    entityType: "REQUEST",
    GSI1PK: `STATUS#${request.status}`,
    GSI1SK: `REQ#${request.updatedAt}#${request.id}`,
    ...(date ? { GSI3PK: `DATE#${date}`, GSI3SK: `REQ#${request.createdAt}#${request.id}` } : {}),
    ownerPK: ownerKey.PK,
    ownerSK: ownerKey.SK,
    ...(firstBooking?.subcategory ? { primarySubcategory: firstBooking.subcategory } : {}),
  } as StoredRequestDetail;
}

function bookingItem(requestId: string, booking: RequestRecord["bookings"][number]): StoredBooking {
  return {
    ...booking,
    ...keys.booking(requestId, booking.id),
    entityType: "BOOKING",
    ...(booking.subcategory ? { GSI2PK: `SUBCAT#${normalizeKey(booking.subcategory)}`, GSI2SK: `REQ#${requestId}#BOOKING#${booking.id}` } : {}),
  };
}

export async function createRequest(request: RequestRecord) {
  const items = [
    requestItem(request),
    {
      ...keys.ownerRequest(request.ownerId, request.createdAt, request.id),
      entityType: "REQUEST_INDEX" as const,
      id: request.id,
      requestId: request.id,
      ownerId: request.ownerId,
      rawInput: request.rawInput,
      status: request.status,
      bookings: request.bookings,
      followUpQuestions: request.followUpQuestions,
      uncertainFields: request.uncertainFields,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      selectedPartnerId: request.selectedPartnerId,
      selectedPartnerName: request.selectedPartnerName,
      selectedPartners: request.selectedPartners,
      date: request.bookings.find((booking) => booking.date)?.date,
    },
    ...request.bookings.map((booking) => bookingItem(request.id, booking)),
    {
      ...keys.parseLog(request.id),
      entityType: "PARSE_LOG" as const,
      requestId: request.id,
      provider: "local" as const,
      parsedAt: request.createdAt,
      confidence: request.bookings.map((booking) => booking.confidence),
    } satisfies StoredParseLog,
  ];
  await transactWrite({
    TransactItems: items.map((Item) => ({ Put: { TableName: config.tableName, Item } })),
  });
  return request;
}

export async function getRequest(requestId: string) {
  const detail = await getItem<StoredRequestDetail>(keys.request(requestId));
  if (!detail) return undefined;
  const childItems = await queryItems<StoredBooking>({
    TableName: config.tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :bookingPrefix)",
    ExpressionAttributeValues: { ":pk": `REQ#${requestId}`, ":bookingPrefix": "BOOKING#" },
  });
  const bookings = childItems.sort((a, b) => a.SK.localeCompare(b.SK)).map(stripKeys<StoredBooking>);
  return { ...stripKeys(detail), bookings } as RequestRecord;
}

export async function listRequests(options: { ownerId?: string; partnerId?: string; status?: string; date?: string; limit?: number }) {
  if (options.partnerId) {
    const items = await scanItems<StoredRequestDetail>({
      TableName: config.tableName,
      FilterExpression: "entityType = :type AND selectedPartnerId = :partnerId",
      ExpressionAttributeValues: { ":type": "REQUEST", ":partnerId": options.partnerId },
      Limit: Math.max(options.limit ?? 50, 100),
    });
    return items.filter((item) => matchesRequestFilter(item, options)).slice(0, options.limit ?? 50).map(stripKeys<StoredRequestDetail>);
  }
  if (options.ownerId) {
    const items = await queryItems<StoredRequestDetail>({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `OWNER#${options.ownerId}`, ":prefix": "REQ#" },
      ScanIndexForward: false,
      Limit: options.limit ?? 50,
    });
    return items.filter((item) => matchesRequestFilter(item, options)).slice(0, options.limit ?? 50).map(stripKeys<StoredRequestDetail>);
  }
  if (options.status) {
    const items = await queryItems<StoredRequestDetail>({
      TableName: config.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `STATUS#${options.status}` },
      ScanIndexForward: false,
      Limit: options.limit ?? 50,
    });
    return items.filter((item) => matchesRequestFilter(item, options)).map(stripKeys<StoredRequestDetail>);
  }
  if (options.date) {
    const items = await queryItems<StoredRequestDetail>({
      TableName: config.tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk",
      ExpressionAttributeValues: { ":pk": `DATE#${options.date}` },
      ScanIndexForward: false,
      Limit: options.limit ?? 50,
    });
    return items.filter((item) => matchesRequestFilter(item, options)).map(stripKeys<StoredRequestDetail>);
  }
  const items = await scanItems<StoredRequestDetail>({
    TableName: config.tableName,
    FilterExpression: "entityType = :type",
    ExpressionAttributeValues: { ":type": "REQUEST" },
    Limit: options.limit ?? 50,
  });
  return items.filter((item) => matchesRequestFilter(item, options)).map(stripKeys<StoredRequestDetail>);
}

export async function updateRequest(requestId: string, changes: Partial<RequestRecord>) {
  const current = await getItem<StoredRequestDetail>(keys.request(requestId));
  if (!current) return undefined;
  const updatedAt = new Date().toISOString();
  const nextStatus = changes.status ?? current.status;
  const nextBookings = changes.bookings ?? current.bookings;
  const date = nextBookings?.find((booking) => booking.date)?.date;
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const expressions: string[] = [];
  for (const [key, value] of Object.entries({
    ...changes,
    status: nextStatus,
    updatedAt,
    GSI1PK: `STATUS#${nextStatus}`,
    GSI1SK: `REQ#${updatedAt}#${requestId}`,
    ...(date ? { GSI3PK: `DATE#${date}`, GSI3SK: `REQ#${updatedAt}#${requestId}` } : {}),
  })) {
    if (["id", "ownerId", "createdAt", "PK", "SK", "entityType"].includes(key) || value === undefined) continue;
    const name = `#${key}`;
    const valueName = `:${key}`;
    names[name] = key;
    values[valueName] = value;
    expressions.push(`${name} = ${valueName}`);
  }
  const removeExpressions = date ? [] : ["#gsi3pk", "#gsi3sk"];
  if (!date) {
    names["#gsi3pk"] = "GSI3PK";
    names["#gsi3sk"] = "GSI3SK";
  }
  if (!expressions.length) return getRequest(requestId);
  await updateItem({
    TableName: config.tableName,
    Key: keys.request(requestId),
    UpdateExpression: `SET ${expressions.join(", ")}${removeExpressions.length ? ` REMOVE ${removeExpressions.join(", ")}` : ""}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  });
  if (current.ownerId && current.createdAt) {
    await updateItem({
      TableName: config.tableName,
      Key: keys.ownerRequest(current.ownerId, current.createdAt, requestId),
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt, #bookings = :bookings, #followUpQuestions = :followUpQuestions, #uncertainFields = :uncertainFields, #selectedPartnerId = :selectedPartnerId, #selectedPartnerName = :selectedPartnerName, #selectedPartners = :selectedPartners, #date = :date",
      ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt", "#bookings": "bookings", "#followUpQuestions": "followUpQuestions", "#uncertainFields": "uncertainFields", "#selectedPartnerId": "selectedPartnerId", "#selectedPartnerName": "selectedPartnerName", "#selectedPartners": "selectedPartners", "#date": "date" },
      ExpressionAttributeValues: {
        ":status": changes.status ?? current.status,
        ":updatedAt": updatedAt,
        ":bookings": changes.bookings ?? current.bookings ?? [],
        ":followUpQuestions": changes.followUpQuestions ?? current.followUpQuestions ?? [],
        ":uncertainFields": changes.uncertainFields ?? current.uncertainFields,
        ":selectedPartnerId": changes.selectedPartnerId ?? current.selectedPartnerId ?? null,
        ":selectedPartnerName": changes.selectedPartnerName ?? current.selectedPartnerName ?? null,
        ":selectedPartners": changes.selectedPartners ?? current.selectedPartners ?? null,
        ":date": date ?? null,
      },
    });
  }
  return getRequest(requestId);
}

export async function replaceRequestBookings(requestId: string, bookings: RequestRecord["bookings"]) {
  const existing = await queryItems<StoredBooking>({
    TableName: config.tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :bookingPrefix)",
    ExpressionAttributeValues: { ":pk": `REQ#${requestId}`, ":bookingPrefix": "BOOKING#" },
  });
  await batchWrite(config.tableName, [
    ...existing.map((item) => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } })),
    ...bookings.map((booking) => ({ PutRequest: { Item: bookingItem(requestId, booking) } })),
  ]);
}

export async function saveParseLog(requestId: string, log: Omit<StoredParseLog, "PK" | "SK" | "entityType" | "requestId">) {
  return putItem({ ...keys.parseLog(requestId), entityType: "PARSE_LOG" as const, requestId, ...log });
}

export async function getParseLog(requestId: string) {
  const item = await getItem<StoredParseLog>(keys.parseLog(requestId));
  return item ? stripKeys(item) : undefined;
}

export async function listPartners() {
  const items = await scanItems<StoredPartner>({
    TableName: config.tableName,
    FilterExpression: "entityType = :type",
    ExpressionAttributeValues: { ":type": "PARTNER" },
  });
  return items.map(stripKeys<StoredPartner>);
}

export async function getPartner(partnerId: string) {
  const item = await getItem<StoredPartner>(keys.partner(partnerId));
  return item ? stripKeys(item) : undefined;
}

export async function savePartner(partner: Partner) {
  const item: StoredPartner = {
    ...partner,
    ...keys.partner(partner.id),
    entityType: "PARTNER",
    ...(partner.subcategories[0] ? { GSI2PK: `SUBCAT#${normalizeKey(partner.subcategories[0])}`, GSI2SK: `PARTNER#${partner.id}` } : {}),
  };
  await putItem(item);
  return partner;
}

export async function deletePartner(partnerId: string) {
  const { deleteItem } = await import("./db.js");
  await deleteItem(keys.partner(partnerId));
}

export async function getScoreConfig() {
  const item = await getItem<ScoreConfig & { PK: string; SK: string }>(keys.scoringConfig());
  return item ? stripKeys(item) : undefined;
}

export async function saveScoreConfig(configValue: ScoreConfig) {
  await putItem({ ...keys.scoringConfig(), entityType: "SCORING_CONFIG", ...configValue });
  return configValue;
}

export async function listEntities(entityType: string) {
  const items = await scanItems<Record<string, unknown>>({
    TableName: config.tableName,
    FilterExpression: "entityType = :type",
    ExpressionAttributeValues: { ":type": entityType },
  });
  return items.map(stripKeys);
}

function stripKeys<T extends Record<string, unknown>>(item: T) {
  const { PK: _pk, SK: _sk, entityType: _entityType, GSI1PK: _gsi1pk, GSI1SK: _gsi1sk, GSI2PK: _gsi2pk, GSI2SK: _gsi2sk, GSI3PK: _gsi3pk, GSI3SK: _gsi3sk, ownerPK: _ownerPk, ownerSK: _ownerSk, ...value } = item;
  return value;
}

function matchesRequestFilter(item: StoredRequestDetail, options: { status?: string; date?: string }) {
  if (options.status && item.status !== options.status) return false;
  if (options.date && item.date !== options.date && !item.bookings?.some((booking) => booking.date === options.date)) return false;
  return true;
}
