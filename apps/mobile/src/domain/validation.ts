import { z } from "zod";
import type { ParseResult } from "./types";

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
  role: z.enum(["chef", "waiter", "cleaner", "helper", "other"]),
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

export const ParseResultSchema = z.object({
  bookings: z.array(BookingSchema).min(1),
  followUpQuestions: z.array(z.string()),
  rawInput: z.string().min(1),
});

export function validateParseResult(value: unknown): ParseResult {
  return ParseResultSchema.parse(value) as ParseResult;
}

export function safeValidateParseResult(value: unknown) {
  return ParseResultSchema.safeParse(value);
}
