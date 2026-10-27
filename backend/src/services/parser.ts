import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { config } from "../config.js";
import type { Booking, ParseResult } from "../types.js";

const RoleSchema = z.enum(["chef", "waiter", "cleaner", "helper", "other"]);
const ConfidenceSchema = z.object({
  role: z.number().min(0).max(1),
  subcategory: z.number().min(0).max(1),
  count: z.number().min(0).max(1),
  date: z.number().min(0).max(1),
  time: z.number().min(0).max(1),
  location: z.number().min(0).max(1),
});

export const BookingSchema = z.object({
    id: z.string().min(1),
    role: RoleSchema,
    subcategory: z.string().nullable(),
    count: z.number().int().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    timeStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
    timeEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
    location: z.string().nullable(),
    notes: z.string().nullable(),
    confidence: ConfidenceSchema,
});

export const ParseOutputSchema = z.object({
  bookings: z.array(BookingSchema).min(1).max(20),
  followUpQuestions: z.array(z.string()),
  rawInput: z.string().min(1),
});

const locations = ["Connaught Place", "Rajouri Garden", "Pitampura", "Karol Bagh", "Lajpat Nagar", "Saket", "Hauz Khas", "Aerocity", "Noida"];

export type ParseProvider = "gemini" | "local";

export async function parseRequestText(rawInput: string): Promise<{ result: ParseResult; provider: ParseProvider; rawOutput?: string }> {
  const source = rawInput.trim();
  if (!source) throw new Error("Request text cannot be empty");
  if (config.geminiApiKey) {
    try {
      return await parseWithGemini(source);
    } catch (error) {
      console.warn("Gemini parse failed; using deterministic fallback", error);
    }
  }
  return { result: parseLocally(source), provider: "local" };
}

async function parseWithGemini(rawInput: string): Promise<{ result: ParseResult; provider: "gemini"; rawOutput: string }> {
  const model = new GoogleGenerativeAI(config.geminiApiKey!).getGenerativeModel({ model: config.geminiModel });
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: [
      "Parse this restaurant staffing request into JSON.",
      "Return only JSON. Never invent missing values; use null and lower confidence when a field is unclear.",
      "Split multiple roles into separate bookings and inherit shared date, time, and location.",
      "Roles must be one of chef, waiter, cleaner, helper, other.",
      "Time values must be HH:mm and dates must be YYYY-MM-DD.",
      "Required JSON shape: { bookings: [{ id, role, subcategory, count, date, dateEnd, timeStart, timeEnd, location, notes, confidence: { role, subcategory, count, date, time, location } }], followUpQuestions: string[], rawInput: string }",
      `Request: ${rawInput}`,
    ].join("\n") }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  });
  const rawOutput = response.response.text();
  const parsed = ParseOutputSchema.parse(JSON.parse(rawOutput));
  return { result: { ...parsed, rawInput }, provider: "gemini", rawOutput };
}

function parseLocally(rawInput: string): ParseResult {
  const parts = rawInput.split(/\s+and\s+(?=\d+\s+)/i).map((part) => part.trim()).filter(Boolean);
  const bookings = parts.map((part, index) => parseBooking(part, rawInput, index));
  const flags = bookings.flatMap((booking) => Object.entries(booking.confidence).filter(([, value]) => value < 0.75).map(([key]) => key));
  const followUpQuestions = [
    flags.includes("date") ? "What date do you need the staff?" : null,
    flags.includes("time") ? "What time should the shift start and end?" : null,
    flags.includes("role") ? "What kind of staff should we arrange?" : null,
    flags.includes("location") ? "Which outlet or area should we send them to?" : null,
  ].filter((value): value is string => Boolean(value));
  return ParseOutputSchema.parse({ bookings, followUpQuestions, rawInput });
}

function parseBooking(text: string, fallback: string, index: number): Booking {
  const role = /clean|sanit|deep clean/i.test(text) ? "cleaner" : /waiter|server|steward/i.test(text) ? "waiter" : /helper|assistant|utility/i.test(text) ? "helper" : /chef|cook|commis/i.test(text) ? "chef" : "other";
  const subcategory = /chinese/i.test(text) ? "Chinese Chef" : /tandoor/i.test(text) ? "Tandoor Chef" : /pastry/i.test(text) ? "Pastry Chef" : /mughlai/i.test(text) ? "Mughlai Chef" : role === "cleaner" ? "Deep Cleaning" : role === "waiter" ? "Waiter" : role === "helper" ? "Kitchen Helper" : role === "chef" ? "General Chef" : null;
  const count = explicitCount(text) ?? 1;
  const date = findDate(text) ?? findDate(fallback);
  const dateEnd = findDateEnd(text) ?? findDateEnd(fallback);
  const time = findTime(text).start ? findTime(text) : findTime(fallback);
  const location = findLocation(text) ?? findLocation(fallback);
  const confidence = {
    role: role === "other" ? 0.25 : 0.92,
    subcategory: subcategory ? 0.9 : 0.3,
    count: explicitCount(text) === null ? 0.7 : 0.95,
    date: date ? (/\d/.test(text) ? 0.97 : 0.76) : 0.08,
    time: time.start && time.end ? time.confidence : time.start ? 0.65 : 0.05,
    location: location ? 0.95 : 0.1,
  };
  return {
    id: `booking-${index + 1}`,
    role,
    subcategory,
    count,
    date,
    dateEnd,
    timeStart: time.start,
    timeEnd: time.end,
    location,
    notes: /budget\s+(?:max|maximum)\s+₹?\s*[\d,]+/i.test(fallback) ? "Budget constraint supplied by owner." : null,
    confidence,
  };
}

function explicitCount(text: string) {
  const countMatch = text.match(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:chinese|tandoor|pastry|mughlai|banquet|kitchen|deep|utility)\s+)?(?:chef|chefs|cook|cooks|cleaner|cleaners|waiter|waiters|server|servers|steward|stewards|helper|helpers|assistant|assistants)\b/i);
  if (countMatch) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return words[countMatch[1].toLowerCase()] ?? Number(countMatch[1]);
  }
  const crewMatch = text.match(/\b(?:crew|team|staff)\s+of\s+(\d+)\b/i);
  return crewMatch ? Number(crewMatch[1]) : null;
}

function findDate(text: string) {
  const range = text.match(/\b(\d{1,2})\s*(?:to|se|[-–])\s*(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (range) return monthDate(Number(range[1]), range[3], indiaNow());
  const explicit = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (explicit) {
    const month = monthIndex(explicit[2]);
    const now = indiaNow();
    const year = month < now.getMonth() || (month === now.getMonth() && Number(explicit[1]) < now.getDate()) ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(Number(explicit[1])).padStart(2, "0")}`;
  }
  if (/tomorrow/i.test(text)) return toDate(addDays(indiaNow(), 1));
  if (/today/i.test(text)) return toDate(indiaNow());
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekday = weekdays.findIndex((day) => new RegExp(`\\b${day.slice(0, 3)}(?:${day.slice(3)})?\\b`, "i").test(text));
  if (weekday >= 0) {
    const date = indiaNow();
    const delta = (weekday - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + delta);
    return toDate(date);
  }
  return null;
}

function findDateEnd(text: string) {
  const range = text.match(/\b(\d{1,2})\s*(?:to|se|[-–])\s*(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (!range) return null;
  return monthDate(Number(range[2]), range[3], indiaNow());
}

function findTime(text: string) {
  const range = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|[-–])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (range) {
    return { start: toTime(Number(range[1]), range[2], range[3] ?? range[6]), end: toTime(Number(range[4]), range[5], range[6] ?? range[3]), confidence: 0.98 };
  }
  const single = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (single) return { start: toTime(Number(single[1]), single[2], single[3]), end: null, confidence: 0.65 };
  if (/morning/i.test(text)) return { start: "08:00", end: "12:00", confidence: 0.58 };
  if (/evening|dinner|night/i.test(text)) return { start: "18:00", end: "23:00", confidence: 0.58 };
  const hindiStart = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*baje(?:\s*se)?\b/i);
  if (hindiStart && /shaam|sham/i.test(text)) return { start: toTime(Number(hindiStart[1]), hindiStart[2], "pm"), end: null, confidence: 0.65 };
  return { start: null, end: null, confidence: 0.05 };
}

function toTime(hour: number, minute = "00", suffix?: string) {
  const meridiem = suffix?.toLowerCase();
  let value = hour;
  if (meridiem === "pm" && value < 12) value += 12;
  if (meridiem === "am" && value === 12) value = 0;
  return `${String(value).padStart(2, "0")}:${minute}`;
}

function toDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function indiaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthDate(day: number, monthName: string, from: Date) {
  const month = monthIndex(monthName);
  const year = from.getUTCFullYear() + (month < from.getUTCMonth() || (month === from.getUTCMonth() && day < from.getUTCDate()) ? 1 : 0);
  return toDate(new Date(Date.UTC(year, month, day, 12)));
}

function monthIndex(monthName: string) {
  return ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(monthName.toLowerCase());
}

function findLocation(text: string) {
  if (/\bcp\b|connaught/i.test(text)) return "Connaught Place";
  return locations.find((value) => text.toLowerCase().includes(value.toLowerCase())) ?? null;
}
