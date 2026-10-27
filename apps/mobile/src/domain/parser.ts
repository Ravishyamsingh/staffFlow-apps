import type { Booking, Confidence, ParseField, ParseResult, Role } from "./types";
import { validateParseResult } from "./validation";

/**
 * Local parser used for the take-home build. The API seam is deliberately
 * small: replace this function with the Gemini call without changing screens.
 * Confidence is explicit so the review screen never silently guesses.
 */
const locations = [
  "Connaught Place",
  "Rajouri Garden",
  "Pitampura",
  "Karol Bagh",
  "Lajpat Nagar",
  "Saket",
  "Hauz Khas",
];

const months: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const quantityWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const countPattern = /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:chinese|tandoor|pastry|mughlai|general|banquet|kitchen|deep|utility)\s+)?(?:chef|chefs|cook|cooks|cleaner|cleaners|waiter|waiters|server|servers|steward|stewards|helper|helpers|assistant|assistants)\b/i;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextWeekday(day: number, from: Date) {
  const result = new Date(from);
  const delta = (day - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + delta);
  return isoDate(result);
}

function addDays(days: number, from: Date) {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return isoDate(result);
}

function monthDate(day: number, monthName: string, from: Date) {
  const month = months[monthName.toLowerCase()];
  if (month === undefined) return null;
  const year = from.getFullYear() + (month < from.getMonth() || (month === from.getMonth() && day < from.getDate()) ? 1 : 0);
  return isoDate(new Date(year, month, day, 12));
}

function parseDate(text: string, referenceDate: Date) {
  const range = text.match(/\b(\d{1,2})\s*(?:to|se|[-–])\s*(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (range) return monthDate(Number(range[1]), range[3], referenceDate);
  const explicit = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (explicit) return monthDate(Number(explicit[1]), explicit[2], referenceDate);
  if (/\btomorrow\b/i.test(text)) return addDays(1, referenceDate);
  if (/\btoday\b/i.test(text)) return isoDate(referenceDate);
  if (/\bsaturday|sat\b/i.test(text)) return nextWeekday(6, referenceDate);
  if (/\bsunday|sun\b/i.test(text)) return nextWeekday(0, referenceDate);
  if (/\bfriday|fri\b/i.test(text)) return nextWeekday(5, referenceDate);
  if (/\bthursday|thu\b/i.test(text)) return nextWeekday(4, referenceDate);
  if (/\bwednesday|wed\b/i.test(text)) return nextWeekday(3, referenceDate);
  if (/\btuesday|tue\b/i.test(text)) return nextWeekday(2, referenceDate);
  if (/\bmonday|mon\b/i.test(text)) return nextWeekday(1, referenceDate);
  if (/\bthis weekend\b/i.test(text)) return nextWeekday(6, referenceDate);
  return null;
}

function parseDateEnd(text: string, referenceDate: Date) {
  const range = text.match(/\b(\d{1,2})\s*(?:to|se|[-–])\s*(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  return range ? monthDate(Number(range[2]), range[3], referenceDate) : null;
}

function parseTime(text: string) {
  const range = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|[-–])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (range) {
    const start = to24Hour(Number(range[1]), range[2], range[3] || range[6]);
    const end = to24Hour(Number(range[4]), range[5], range[6] || range[3]);
    return { start, end, confidence: 0.98 };
  }
  const single = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (single) {
    const start = to24Hour(Number(single[1]), single[2], single[3]);
    return { start, end: null, confidence: 0.66 };
  }
  const hindiSingle = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*baje(?:\s*se)?\b/i);
  if (hindiSingle && /shaam|sham/i.test(text)) return { start: to24Hour(Number(hindiSingle[1]), hindiSingle[2], "pm"), end: null, confidence: 0.65 };
  if (/morning/i.test(text)) return { start: "08:00", end: "12:00", confidence: 0.58 };
  if (/evening|shaam/i.test(text)) return { start: "18:00", end: "23:00", confidence: 0.58 };
  return { start: null, end: null, confidence: 0.05 };
}

function to24Hour(hour: number, minute = "00", meridiem?: string) {
  const suffix = meridiem?.toLowerCase();
  let value = hour;
  if (suffix === "pm" && value < 12) value += 12;
  if (suffix === "am" && value === 12) value = 0;
  return `${String(value).padStart(2, "0")}:${minute || "00"}`;
}

function findLocation(text: string) {
  if (/\bcp\b|connaught/i.test(text)) return "Connaught Place";
  return locations.find((location) => text.toLowerCase().includes(location.toLowerCase())) ?? null;
}

function confidenceFor(booking: Booking): Confidence {
  return booking.confidence;
}

function baseBooking(id: string, text: string, fallbackText: string, role: Role, subcategory: string | null, count: number, referenceDate: Date): Booking {
  const date = parseDate(text, referenceDate) ?? parseDate(fallbackText, referenceDate);
  const dateEnd = parseDateEnd(text, referenceDate) ?? parseDateEnd(fallbackText, referenceDate);
  const parsedTime = parseTime(text);
  const time = parsedTime.start ? parsedTime : parseTime(fallbackText);
  const location = findLocation(text) ?? findLocation(fallbackText);
  const isExplicitRole = role !== "other";
  const confidence: Confidence = {
    role: isExplicitRole ? 0.94 : 0.28,
    subcategory: subcategory ? 0.92 : 0.35,
    count: explicitCount(text) === null ? 0.72 : 0.95,
    date: date ? (/\d/.test(text) ? 0.98 : 0.76) : 0.08,
    time: time.start && time.end ? time.confidence : time.start ? 0.66 : 0.05,
    location: location ? 0.96 : 0.12,
  };
  return {
    id,
    role,
    subcategory,
    count,
    date,
    dateEnd,
    timeStart: time.start,
    timeEnd: time.end,
    location,
    notes: null,
    confidence,
  };
}

function fieldFlags(booking: Booking): ParseField[] {
  const fields: ParseField[] = [];
  if (booking.confidence.role < 0.75) fields.push("role");
  if (booking.confidence.subcategory < 0.75) fields.push("subcategory");
  if (booking.confidence.count < 0.75) fields.push("count");
  if (booking.confidence.date < 0.75) fields.push("date");
  if (booking.confidence.time < 0.75) fields.push("time");
  if (booking.confidence.location < 0.75) fields.push("location");
  return fields;
}

function parseRole(text: string): { role: Role; subcategory: string | null; count: number } {
  const count = explicitCount(text) ?? 1;
  if (/chinese/i.test(text)) return { role: "chef", subcategory: "Chinese Chef", count };
  if (/tandoor/i.test(text)) return { role: "chef", subcategory: "Tandoor Chef", count };
  if (/pastry/i.test(text)) return { role: "chef", subcategory: "Pastry Chef", count };
  if (/mughlai/i.test(text)) return { role: "chef", subcategory: "Mughlai Chef", count };
  if (/clean|sanit|deep clean/i.test(text)) return { role: "cleaner", subcategory: "Deep Cleaning", count };
  if (/waiter|server|steward/i.test(text)) return { role: "waiter", subcategory: "Waiter", count };
  if (/helper|assistant|utility/i.test(text)) return { role: "helper", subcategory: "Kitchen Helper", count };
  if (/chef|cook/i.test(text)) return { role: "chef", subcategory: "General Chef", count };
  return { role: "other", subcategory: null, count };
}

function explicitCount(text: string) {
  const countMatch = text.match(countPattern);
  if (countMatch) {
    const countToken = countMatch[1].toLowerCase();
    return quantityWords[countToken] ?? Number(countToken);
  }
  const crewMatch = text.match(/\b(?:crew|team|staff)\s+of\s+(\d+)\b/i);
  return crewMatch ? Number(crewMatch[1]) : null;
}

function splitRequests(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const split = normalized.match(/^(.*?)(?:\s+and\s+)(\d+\s+(?:a\s+)?(?:helper|cleaner|waiter|chef)\b.*)$/i);
  if (split) return [split[1], split[2]];
  return [normalized];
}

function addNotes(booking: Booking, text: string) {
  const budget = text.match(/budget\s+(?:max|maximum)\s+₹?\s*([\d,]+)/i);
  if (budget) booking.notes = `Budget cap ₹${budget[1]}/day`;
  if (/cancel my last/i.test(text)) booking.notes = "Owner asked to cancel the last request before booking this replacement.";
  return booking;
}

export function parseStaffRequest(rawInput: string, referenceDate = new Date()): ParseResult {
  const source = rawInput.trim();
  const parts = splitRequests(source);
  const bookings = parts.map((part, index) => {
    const parsed = parseRole(part);
    const booking = baseBooking(`booking-${index + 1}`, part, source, parsed.role, parsed.subcategory, parsed.count, referenceDate);
    return addNotes(booking, source);
  });

  const followUpQuestions: string[] = [];
  const flags = bookings.flatMap(fieldFlags);
  if (flags.includes("date")) followUpQuestions.push("What date do you need the staff?");
  if (flags.includes("time")) followUpQuestions.push("What time should the shift start and end?");
  if (flags.includes("role")) followUpQuestions.push("What kind of staff should we arrange?");
  if (flags.includes("location")) followUpQuestions.push("Which outlet or area should we send them to?");

  const result = { bookings, followUpQuestions, rawInput: source };
  return validateParseResult(result);
}

export function flaggedFields(booking: Booking): ParseField[] {
  return fieldFlags(booking);
}

export function confidenceForField(booking: Booking, field: ParseField) {
  if (field === "notes") return 1;
  return confidenceFor(booking)[field];
}
