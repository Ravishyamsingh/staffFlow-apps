import type { Booking, Partner, PartnerMatch, ScoreConfig } from "../types.js";
import { DEFAULT_SCORE_CONFIG } from "../types.js";

export function rankPartners(booking: Booking, partners: Partner[], scoreConfig: ScoreConfig = DEFAULT_SCORE_CONFIG) {
  return partners
    .filter((partner) => partner.role === booking.role || partner.role === "other")
    .map((partner) => scorePartner(booking, partner, scoreConfig))
    .sort((a, b) => b.score - a.score || b.reliability - a.reliability || a.distanceKm - b.distanceKm)
    .slice(0, 5)
    .map((match, index) => ({ ...match, rank: index + 1 }));
}

export function scorePartner(booking: Booking, partner: Partner, scoreConfig: ScoreConfig): PartnerMatch {
  const components = {
    subcategoryFit: booking.subcategory && partner.subcategories.includes(booking.subcategory) ? 1 : booking.role === partner.role ? 0.6 : 0,
    distanceFit: Math.max(0, Math.min(1, 1 - partner.distanceKm / 15)),
    availabilityFit: availabilityFit(booking, partner),
    reliabilityFit: Math.max(0, Math.min(1, partner.reliability / 5)),
  };
  const score = components.subcategoryFit * scoreConfig.subcategoryFit
    + components.distanceFit * scoreConfig.distanceFit
    + components.availabilityFit * scoreConfig.availabilityFit
    + components.reliabilityFit * scoreConfig.reliabilityFit;
  const reasons = [
    components.subcategoryFit >= 0.9 ? "top subcategory match" : components.subcategoryFit >= 0.6 ? "same role experience" : null,
    partner.distanceKm <= 2 ? "closest location" : partner.distanceKm <= 5 ? "nearby outlet" : null,
    components.availabilityFit >= 0.9 ? "available for this shift" : null,
    partner.reliability >= 4.7 ? "high reliability" : null,
  ].filter((value): value is string => Boolean(value));
  return { ...partner, score, components, reason: reasons.join(" • ") || "best available alternative" };
}

function availabilityFit(booking: Booking, partner: Partner) {
  if (!booking.date) return 0.5;
  const weekday = new Date(`${booking.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return partner.availability.includes(weekday) ? 1 : 0.2;
}
