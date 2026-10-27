import type { Booking, Partner, PartnerMatch, ScoreComponents } from "./types";

export const DEFAULT_WEIGHTS = {
  subcategoryFit: 0.35,
  distanceFit: 0.25,
  availabilityFit: 0.2,
  reliabilityFit: 0.2,
};

function subcategoryFit(booking: Booking, partner: Partner) {
  if (booking.subcategory && partner.subcategories.includes(booking.subcategory)) return 1;
  if (booking.role === partner.role) return 0.6;
  return 0;
}

function distanceFit(partner: Partner) {
  return Math.max(0, Math.min(1, 1 - partner.distanceKm / 15));
}

function availabilityFit(booking: Booking, partner: Partner) {
  if (!booking.date) return 0.5;
  const weekday = new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
  return partner.availability.includes(weekday) ? 1 : 0.2;
}

export function scorePartner(booking: Booking, partner: Partner, weights = DEFAULT_WEIGHTS): PartnerMatch {
  const components: ScoreComponents = {
    subcategoryFit: subcategoryFit(booking, partner),
    distanceFit: distanceFit(partner),
    availabilityFit: availabilityFit(booking, partner),
    reliabilityFit: partner.reliability / 5,
  };
  const score = Object.entries(components).reduce(
    (total, [key, value]) => total + value * weights[key as keyof typeof weights],
    0,
  );
  const reasons = [
    components.subcategoryFit >= 0.9 ? "top subcategory match" : components.subcategoryFit >= 0.6 ? "same role experience" : null,
    partner.distanceKm <= 2 ? "closest location" : partner.distanceKm <= 5 ? "nearby outlet" : null,
    components.availabilityFit >= 0.9 ? "available for this shift" : null,
    partner.reliability >= 4.7 ? "high reliability" : null,
  ].filter(Boolean);
  return {
    ...partner,
    score,
    components,
    reason: reasons.join(" • ") || "best available alternative",
  };
}

export function rankPartners(booking: Booking, partners: Partner[], weights = DEFAULT_WEIGHTS) {
  return partners
    .filter((partner) => partner.role === booking.role || partner.role === "other")
    .map((partner) => scorePartner(booking, partner, weights))
    .sort((a, b) => b.score - a.score || b.reliability - a.reliability || a.distanceKm - b.distanceKm)
    .slice(0, 5);
}
