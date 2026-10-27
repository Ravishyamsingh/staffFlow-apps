export type Role = "chef" | "waiter" | "cleaner" | "helper" | "other";
export type RequestStatus = "new" | "parsed" | "reviewed" | "matched" | "confirmed" | "completed" | "cancelled";

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
  confidence: Record<"role" | "subcategory" | "count" | "date" | "time" | "location", number>;
};

export type AdminRequest = {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  ownerPhone?: string;
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
  phoneNumber?: string;
  email?: string;
};

export type PartnerMatch = Partner & {
  score: number;
  components: { subcategoryFit: number; distanceFit: number; availabilityFit: number; reliabilityFit: number };
  reason: string;
  rank?: number;
};

export type ScoreConfig = {
  subcategoryFit: number;
  distanceFit: number;
  availabilityFit: number;
  reliabilityFit: number;
};

export function formatSlot(request: AdminRequest) {
  const booking = request.bookings[0];
  if (!booking) return "No booking details";
  const date = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "Date pending";
  const time = booking.timeStart && booking.timeEnd ? `${booking.timeStart}–${booking.timeEnd}` : "Time pending";
  return `${date}\n${time}`;
}

export function formatSummary(request: AdminRequest) {
  return request.bookings.map((booking) => `${booking.subcategory ?? booking.role} ×${booking.count}`).join(" + ") || request.rawInput;
}

export function labelForStatus(status: RequestStatus) {
  return status === "parsed" ? "Pending review" : status[0].toUpperCase() + status.slice(1);
}
