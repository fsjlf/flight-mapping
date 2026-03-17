import { EnrichedItinerary } from "./types";

/**
 * Build a flight fingerprint key matching the backend SplitPnrDetector.BuildFlightKey().
 * Format: "carrier+flight_origin+dest_date|..." per segment.
 */
export function buildFlightKey(itin: EnrichedItinerary): string {
  return itin.segments
    .map(
      (s) =>
        `${s.marketingCarrier}${s.flightNumber}_${s.origin}${s.destination}_${s.departureTime.slice(0, 10).replace(/-/g, "")}`,
    )
    .join("|");
}
