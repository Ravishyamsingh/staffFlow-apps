import { create } from "zustand";
import type { Booking, BookingMatchGroup, PartnerMatch, ParseField, ParseResult, RequestRecord } from "../domain/types";
import { apiRequest } from "../lib/api";
import { clearSession, getValidSession, type CognitoSession } from "../lib/auth";

type Store = {
  language: "en" | "hi" | null;
  authenticated: boolean;
  hydrated: boolean;
  session: CognitoSession | null;
  requestId: string | null;
  draft: ParseResult | null;
  matches: PartnerMatch[];
  matchGroups: BookingMatchGroup[];
  selectedPartner: PartnerMatch | null;
  selectedPartners: Record<string, PartnerMatch>;
  requests: RequestRecord[];
  setLanguage: (language: "en" | "hi") => void;
  hydrateAuth: () => Promise<void>;
  setSession: (session: CognitoSession | null) => void;
  signOut: () => Promise<void>;
  setDraft: (draft: ParseResult | null) => void;
  setRequestRecord: (request: RequestRecord) => void;
  loadRequests: () => Promise<void>;
  updateBooking: (bookingId: string, changes: Partial<Booking>) => void;
  resolveField: (bookingId: string, field: ParseField, value: unknown) => void;
  saveDraft: () => Promise<RequestRecord | null>;
  setMatches: (matches: PartnerMatch[]) => void;
  loadMatches: () => Promise<void>;
  setMatchGroups: (groups: BookingMatchGroup[]) => void;
  selectPartner: (bookingId: string, partner: PartnerMatch) => void;
  confirmRequest: () => Promise<RequestRecord | null>;
  resetDraft: () => void;
};

export const useStaffFlowStore = create<Store>((set, get) => ({
  language: null,
  authenticated: false,
  hydrated: false,
  session: null,
  requestId: null,
  draft: null,
  matches: [],
  matchGroups: [],
  selectedPartner: null,
  selectedPartners: {},
  requests: [],
  setLanguage: (language) => set({ language }),
  hydrateAuth: async () => { const session = await getValidSession(); set({ session, authenticated: Boolean(session), hydrated: true }); },
  setSession: (session) => set({ session, authenticated: Boolean(session), hydrated: true }),
  signOut: async () => { await clearSession(); set({ session: null, authenticated: false, requestId: null, draft: null, requests: [] }); },
  setDraft: (draft) => set({ draft, requestId: null, matches: [], matchGroups: [], selectedPartner: null, selectedPartners: {} }),
  setRequestRecord: (request) => set({ requestId: request.id, draft: { rawInput: request.rawInput, bookings: request.bookings, followUpQuestions: request.followUpQuestions ?? [] }, matches: [], matchGroups: [], selectedPartner: null, selectedPartners: {} }),
  loadRequests: async () => { const result = await apiRequest<{ requests: RequestRecord[] }>("/requests?limit=100"); set({ requests: result.requests }); },
  updateBooking: (bookingId, changes) => set((state) => ({ draft: state.draft ? { ...state.draft, bookings: state.draft.bookings.map((booking) => booking.id === bookingId ? { ...booking, ...changes } : booking) } : null })),
  resolveField: (bookingId, field, value) => set((state) => ({ draft: state.draft ? { ...state.draft, bookings: state.draft.bookings.map((booking) => { if (booking.id !== bookingId) return booking; const confidence = { ...booking.confidence }; if (field in confidence) confidence[field as keyof typeof confidence] = 1; const changes = field === "date" ? { date: String(value) } : field === "time" ? { timeStart: (value as { start: string; end: string }).start, timeEnd: (value as { start: string; end: string }).end } : field === "role" ? { role: value as Booking["role"], subcategory: null } : field === "subcategory" ? { subcategory: String(value), role: roleForSubcategory(String(value)) } : { [field]: value }; if (field === "role") confidence.subcategory = 0.35; if (field === "subcategory") confidence.role = 1; return { ...booking, ...changes, confidence }; }) } : null })),
  saveDraft: async () => { const { requestId, draft } = get(); if (!requestId || !draft) return null; const result = await apiRequest<RequestRecord>(`/requests/${requestId}`, { method: "PATCH", body: { bookings: draft.bookings, followUpQuestions: draft.followUpQuestions, status: "reviewed" } }); get().setRequestRecord(result); return result; },
  setMatches: (matches) => set({ matches }),
  loadMatches: async () => { const { requestId } = get(); if (!requestId) return; const result = await apiRequest<{ groups?: BookingMatchGroup[]; matches: PartnerMatch[] }>(`/requests/${requestId}/matches`); const groups = result.groups ?? [{ bookingId: get().draft?.bookings[0]?.id ?? "booking", matches: result.matches }]; get().setMatchGroups(groups); },
  setMatchGroups: (matchGroups) => set({ matchGroups, matches: matchGroups[0]?.matches ?? [], selectedPartner: null, selectedPartners: {} }),
  selectPartner: (bookingId, partner) => set((state) => ({ selectedPartners: { ...state.selectedPartners, [bookingId]: partner }, matchGroups: state.matchGroups.map((group) => group.bookingId === bookingId ? { ...group, selectedPartnerId: partner.id } : group) })),
  confirmRequest: async () => { const { requestId, draft, selectedPartners } = get(); if (!requestId || !draft || draft.bookings.some((booking) => !selectedPartners[booking.id])) return null; const assignments = Object.fromEntries(draft.bookings.map((booking) => [booking.id, selectedPartners[booking.id].id])); const first = selectedPartners[draft.bookings[0].id]; const result = await apiRequest<RequestRecord>(`/requests/${requestId}/confirm`, { method: "PUT", body: { assignments, partnerId: first.id, partnerName: first.name } }); set((state) => ({ requests: [result, ...state.requests.filter((request) => request.id !== result.id)], selectedPartner: first })); return result; },
  resetDraft: () => set({ draft: null, requestId: null, matches: [], matchGroups: [], selectedPartner: null, selectedPartners: {} }),
}));

function roleForSubcategory(subcategory: string): Booking["role"] { if (/clean/i.test(subcategory)) return "cleaner"; if (/waiter|server/i.test(subcategory)) return "waiter"; if (/helper|utility|assistant/i.test(subcategory)) return "helper"; if (/chef|cook/i.test(subcategory)) return "chef"; return "other"; }
