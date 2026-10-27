import { describe, expect, it } from "vitest";
import { getAuthContext, hasRole, requireRole } from "../src/auth/claims.js";
import { forbidden } from "../src/lib/errors.js";
import { rankPartners } from "../src/services/matching.js";
import { parseRequestText } from "../src/services/parser.js";
import type { Partner } from "../src/types.js";
import { getConfig } from "../src/config.js";

describe("Cognito group authorization", () => {
  const event = {
    requestContext: { authorizer: { jwt: { claims: { sub: "owner-1", email: "owner@example.com", "cognito:groups": "owner" } } } },
  } as never;

  it("maps Cognito groups and user claims into the backend context", () => {
    const context = getAuthContext(event);
    expect(context.sub).toBe("owner-1");
    expect(context.email).toBe("owner@example.com");
    expect(context.groups).toEqual(["owner"]);
    expect(hasRole(context, "owner")).toBe(true);
    expect(hasRole(context, "admin")).toBe(false);
  });

  it("accepts JSON-array group claims from API Gateway", () => {
    const context = getAuthContext({ requestContext: { authorizer: { jwt: { claims: { sub: "admin-1", "cognito:groups": '["admin","operation"]' } } } } } as never);
    expect(context.groups).toEqual(["admin", "operation"]);
  });

  it("rejects a role that cannot access an operation", () => {
    const context = getAuthContext(event);
    expect(() => requireRole(context, "admin")).toThrowError(forbidden("Required role: admin"));
  });
});

describe("backend request parsing and matching", () => {
  it("returns a validated local parse when Gemini is not configured", async () => {
    const parsed = await parseRequestText("2 Chinese chefs for Saturday 6 PM to 11 PM in Connaught Place");
    expect(parsed.provider).toBe("local");
    expect(parsed.result.bookings[0].role).toBe("chef");
    expect(parsed.result.bookings[0].count).toBe(2);
    expect(parsed.result.bookings[0].location).toBe("Connaught Place");
  });

  it("handles crew quantities and date ranges in the local fallback", async () => {
    const parsed = await parseRequestText("Deep cleaning crew of 3 for Sunday morning, Pitampura outlet.");
    expect(parsed.result.bookings[0].count).toBe(3);
    const range = await parseRequestText("Waiter, 28 se 30 October, Karol Bagh");
    expect(range.result.bookings[0].dateEnd).toMatch(/^\d{4}-10-30$/);
  });

  it("ranks an exact subcategory and available partner first", () => {
    const partners: Partner[] = [
      { id: "p-1", name: "Exact", role: "chef", subcategories: ["Chinese Chef"], area: "CP", distanceKm: 1, reliability: 4.9, shiftsCompleted: 20, availability: ["Sat"] },
      { id: "p-2", name: "Weak", role: "chef", subcategories: ["Tandoor Chef"], area: "Far", distanceKm: 10, reliability: 3.2, shiftsCompleted: 4, availability: ["Mon"] },
    ];
    const booking = { id: "b-1", role: "chef" as const, subcategory: "Chinese Chef", count: 1, date: "2026-10-31", dateEnd: null, timeStart: "18:00", timeEnd: "23:00", location: "Connaught Place", notes: null, confidence: { role: 1, subcategory: 1, count: 1, date: 1, time: 1, location: 1 } };
    expect(rankPartners(booking, partners)[0].id).toBe("p-1");
  });

  it("treats Serverless empty optional environment values as unset", () => {
    const parsed = getConfig({ MY_AWS_REGION: "", AWS_REGION: "", DYNAMODB_TABLE_NAME: "", S3_BUCKET_NAME: "", COGNITO_USER_POOL_ID: "", COGNITO_CLIENT_ID: "", COGNITO_MOBILE_CLIENT_ID: "", COGNITO_ISSUER_URL: "", GEMINI_API_KEY: "", GEMINI_MODEL: "", CORS_ORIGINS: "", WEBSOCKET_API_ENDPOINT: "", WS_CONNECTIONS_TABLE_NAME: "" });
    expect(parsed.region).toBe("ap-south-1");
    expect(parsed.bucketName).toBeUndefined();
    expect(parsed.cognitoIssuerUrl).toBeUndefined();
    expect(parsed.geminiModel).toBe("gemini-2.0-flash");
    expect(getConfig({ MY_AWS_REGION: "eu-west-1", DYNAMODB_TABLE_NAME: "StaffFlow" }).region).toBe("eu-west-1");
  });
});
