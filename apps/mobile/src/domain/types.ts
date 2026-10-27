export type Role = "chef" | "waiter" | "cleaner" | "helper" | "other";
export type ParseField =
  | "role"
  | "subcategory"
  | "count"
  | "date"
  | "time"
  | "location"
  | "notes";

export type Confidence = Record<
  "role" | "subcategory" | "count" | "date" | "time" | "location",
  number
>;

export type Booking = {
  id: string;
  role: Role;
  subcategory: string | null;
  count: number;
  date: string | null;
  dateEnd?: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  location: string | null;
  notes: string | null;
  confidence: Confidence;
};

export type ParseResult = {
  bookings: Booking[];
  followUpQuestions: string[];
  rawInput: string;
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
};

export type ScoreComponents = {
  subcategoryFit: number;
  distanceFit: number;
  availabilityFit: number;
  reliabilityFit: number;
};

export type PartnerMatch = Partner & {
  rank?: number;
  score: number;
  components: ScoreComponents;
  reason: string;
};

export type BookingMatchGroup = {
  bookingId: string;
  matches: PartnerMatch[];
  selectedPartnerId?: string;
};

export type RequestStatus = "new" | "parsed" | "reviewed" | "matched" | "pending" | "confirmed" | "completed" | "cancelled";

export type RequestRecord = {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt?: string;
  rawInput: string;
  bookings: Booking[];
  followUpQuestions?: string[];
  uncertainFields?: number;
  status: RequestStatus;
  selectedPartnerId?: string;
  selectedPartnerName?: string;
  selectedPartners?: Record<string, { id: string; name: string }>;
};
