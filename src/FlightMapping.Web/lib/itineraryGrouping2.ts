import { EnrichedItinerary } from "./types";

export interface ItineraryGroup {
  primary: EnrichedItinerary;
  variants: EnrichedItinerary[];
  flightKey: string;
}

/** Build a key identifying the physical flights in an itinerary. */
export function buildFlightKey(itin: EnrichedItinerary): string {
  return itin.segments
    .flatMap((seg) => seg.legs)
    .map(
      (leg) =>
        `${leg.operatingCarrier}${leg.operatingFlightNumber}-${leg.departureTime}`
    )
    .join("|");
}

/**
 * Build a key identifying the fare product (cabin + booking class across segments).
 * Two itineraries with the same fare key are codeshare/ticketing variants of the
 * same fare — we only keep the cheapest.
 */
function buildFareKey(itin: EnrichedItinerary): string {
  return itin.segments
    .map((seg) => {
      const brand = seg.brand?.name ?? "";
      return `${seg.cabin}:${seg.bookingClass}:${brand}`;
    })
    .join("|");
}

/**
 * Deduplicate within a group: for each unique fare product (cabin + class + brand),
 * keep only the cheapest itinerary. Returns deduplicated array sorted by price.
 */
function deduplicateFares(itineraries: EnrichedItinerary[]): EnrichedItinerary[] {
  const fareMap = new Map<string, EnrichedItinerary>();
  for (const itin of itineraries) {
    const fk = buildFareKey(itin);
    const existing = fareMap.get(fk);
    if (!existing || itin.pricing.pricePerAdult < existing.pricing.pricePerAdult) {
      fareMap.set(fk, itin);
    }
  }
  return Array.from(fareMap.values()).sort(
    (a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult
  );
}

/**
 * Group itineraries that share the same physical flights, then deduplicate
 * codeshare/ticketing variants within each group, keeping one per fare product.
 * Primary = cheapest fare in the group.
 * Variants = remaining distinct fare products, sorted by price.
 * Group order matches the first appearance of each flight key in the input.
 */
export function groupByFlight(
  itineraries: EnrichedItinerary[]
): ItineraryGroup[] {
  const map = new Map<string, EnrichedItinerary[]>();
  const order: string[] = [];

  for (const itin of itineraries) {
    const key = buildFlightKey(itin);
    const existing = map.get(key);
    if (existing) {
      existing.push(itin);
    } else {
      map.set(key, [itin]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const raw = map.get(key)!;
    const deduplicated = deduplicateFares(raw);
    const [primary, ...rest] = deduplicated;
    return {
      primary,
      variants: rest,
      flightKey: key,
    };
  });
}
