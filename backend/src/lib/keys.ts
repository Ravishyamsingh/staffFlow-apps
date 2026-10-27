export const keys = {
  owner: (ownerId: string) => ({ PK: `OWNER#${ownerId}`, SK: "PROFILE" as const }),
  ownerRequest: (ownerId: string, createdAt: string, requestId: string) => ({
    PK: `OWNER#${ownerId}`,
    SK: `REQ#${createdAt}#${requestId}`,
  }),
  request: (requestId: string) => ({ PK: `REQ#${requestId}`, SK: "DETAIL" as const }),
  booking: (requestId: string, bookingId: string) => ({ PK: `REQ#${requestId}`, SK: `BOOKING#${bookingId}` }),
  match: (requestId: string, partnerId: string) => ({ PK: `REQ#${requestId}`, SK: `MATCH#${partnerId}` }),
  parseLog: (requestId: string) => ({ PK: `REQ#${requestId}`, SK: "PARSELOG" as const }),
  partner: (partnerId: string) => ({ PK: `PARTNER#${partnerId}`, SK: "PROFILE" as const }),
  partnerAvailability: (partnerId: string, day: string) => ({ PK: `PARTNER#${partnerId}`, SK: `AVAIL#${day}` }),
  subcategory: (subcategoryId: string) => ({ PK: `SUBCAT#${subcategoryId}`, SK: "DETAIL" as const }),
  location: (locationId: string) => ({ PK: `LOCATION#${locationId}`, SK: "DETAIL" as const }),
  scoringConfig: () => ({ PK: "CONFIG#SCORING", SK: "CURRENT" as const }),
  connection: (connectionId: string) => ({ PK: `CONNECTION#${connectionId}`, SK: "DETAIL" as const }),
};

export function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
