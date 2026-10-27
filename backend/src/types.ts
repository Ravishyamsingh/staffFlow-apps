import type { Booking as MobileBooking, Confidence, ParseResult as MobileParseResult, Role } from "../../apps/mobile/src/domain/types.js";

export type UserRole = "admin" | "operation" | "owner" | "partner";
export type RequestStatus = "new" | "parsed" | "reviewed" | "matched" | "confirmed" | "completed" | "cancelled";

export type Booking = MobileBooking;
export type ParseResult = MobileParseResult;

export type AuthContext = {
  sub: string;
  username?: string;
  email?: string;
  phoneNumber?: string;
  groups: UserRole[];
  claims: Record<string, unknown>;
};

export type RequestRecord = {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  ownerPhone?: string;
  restaurantId?: string;
  rawInput: string;
  status: RequestStatus;
  bookings: Booking[];
  followUpQuestions: string[];
  uncertainFields: number;
  selectedPartnerId?: string;
  selectedPartnerName?: string;
  selectedPartners?: Record<string, { id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
};

export type Partner = {
  id: string;
  name: string;
  role: Role;
  subcategories: string[];
  area: string;
  distanceKm: number;
  reliability: number;
  shiftsCompleted: number;
  availability: string[];
  verified?: boolean;
  ownerUserId?: string;
  phoneNumber?: string;
  email?: string;
};

export type ScoreComponents = {
  subcategoryFit: number;
  distanceFit: number;
  availabilityFit: number;
  reliabilityFit: number;
};

export type PartnerMatch = Partner & {
  score: number;
  components: ScoreComponents;
  reason: string;
  rank?: number;
};

export type ScoreConfig = {
  subcategoryFit: number;
  distanceFit: number;
  availabilityFit: number;
  reliabilityFit: number;
};

export type BookingInput = Partial<Booking> & Pick<Booking, "id">;

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  subcategoryFit: 0.35,
  distanceFit: 0.25,
  availabilityFit: 0.2,
  reliabilityFit: 0.2,
};

export type StoredRequestDetail = RequestRecord & {
  PK: string;
  SK: "DETAIL";
  entityType: "REQUEST";
  GSI1PK: string;
  GSI1SK: string;
  GSI3PK?: string;
  GSI3SK?: string;
  date?: string | null;
};

export type StoredBooking = Booking & {
  PK: string;
  SK: string;
  entityType: "BOOKING";
  GSI2PK?: string;
  GSI2SK?: string;
};

export type StoredPartner = Partner & {
  PK: string;
  SK: "PROFILE";
  entityType: "PARTNER";
  GSI2PK?: string;
  GSI2SK?: string;
};

export type StoredParseLog = {
  PK: string;
  SK: "PARSELOG";
  entityType: "PARSE_LOG";
  requestId: string;
  provider: "gemini" | "local";
  rawOutput?: string;
  parsedAt: string;
  confidence: Confidence[];
};
