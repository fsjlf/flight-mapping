import {
  SearchResponse,
  SegmentInput,
  PassengerConfig,
  SearchPreferences,
  EnrichedItinerary,
  SearchHistoryEntry,
  SearchHistoryExport,
  SlimItinerary,
  SlimSegment,
  SlimFare,
} from "./types";
import { groupItineraries } from "./itineraryGrouping";
import { groupByFlight, ItineraryGroup } from "./itineraryGrouping2";

// Max unique flight combos exported per category
const MAX_PER_CATEGORY = 50;

// ---------------------------------------------------------------------------
// Transform helpers: EnrichedItinerary → SlimItinerary
// ---------------------------------------------------------------------------

function slimSegment(seg: EnrichedItinerary["segments"][number]): SlimSegment {
  const slim: SlimSegment = {
    from: seg.origin,
    to: seg.destination,
    depart: seg.departureTime,
    arrive: seg.arrivalTime,
    duration: seg.durationFormatted,
    stops: seg.stops,
    carrier: seg.marketingCarrier,
    flight: seg.flightNumber,
    cabin: seg.cabin,
    bookingClass: seg.bookingClass,
    equipment: seg.equipment,
  };
  // Only include operated-by if it differs from marketing carrier
  if (seg.operatingCarrier && seg.operatingCarrier !== seg.marketingCarrier) {
    slim.operated = seg.operatingCarrier;
  }
  if (seg.brand?.name) {
    slim.brand = seg.brand.name;
  }
  return slim;
}

function slimFare(itin: EnrichedItinerary): SlimFare {
  const brandName = itin.segments
    .map((s) => s.brand?.name)
    .find((n) => n);
  return {
    name: brandName || itin.segments.map((s) => s.bookingClass).join("/"),
    perAdult: itin.pricing.pricePerAdult,
    refundable: !itin.farePolicy.nonRefundable,
  };
}

/**
 * Collapse a groupByFlight group into one SlimItinerary.
 * Primary = cheapest fare. Fares array = all distinct fare options.
 */
function slimGroup(group: ItineraryGroup): SlimItinerary {
  const { primary, variants } = group;
  const allItins = [primary, ...variants];

  // Build fare summary (deduplicated by name+price)
  const fareMap = new Map<string, SlimFare>();
  for (const itin of allItins) {
    const fare = slimFare(itin);
    const key = `${fare.name}|${fare.perAdult}`;
    if (!fareMap.has(key)) {
      fareMap.set(key, fare);
    }
  }
  const fares = Array.from(fareMap.values()).sort(
    (a, b) => a.perAdult - b.perAdult
  );

  return {
    segments: primary.segments.map(slimSegment),
    totalDuration: primary.totalDurationFormatted,
    price: primary.pricing.pricePerAdult,
    currency: primary.pricing.currencyCode,
    score: primary.scores.overall,
    carrier: primary.validatingCarrier,
    refundable: !primary.farePolicy.nonRefundable,
    fares,
  };
}

/**
 * Deduplicate + slim + cap a list of itineraries.
 * Returns at most `max` unique flight combos as SlimItinerary[].
 */
function slimAndCap(
  itineraries: EnrichedItinerary[],
  max: number = MAX_PER_CATEGORY
): SlimItinerary[] {
  const groups = groupByFlight(itineraries);
  return groups.slice(0, max).map(slimGroup);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a compact SearchHistoryEntry from request params and response.
 * Deduplicates itineraries, strips nested data, caps per category.
 */
export function buildHistoryEntry(
  request: {
    segments: SegmentInput[];
    passengers: PassengerConfig;
    preferences?: SearchPreferences;
  },
  response: SearchResponse
): SearchHistoryEntry {
  const grouped = groupItineraries(response.itineraries, request.segments);

  return {
    searchId: response.searchId,
    timestamp: new Date().toISOString(),
    request,
    results: {
      tripType: response.classification.type,
      roundTrip: slimAndCap(grouped.singleTickets),
      mixAndMatch: request.segments
        .map((seg, i) => ({
          leg: i,
          route: `${seg.origin}→${seg.destination}`,
          date: seg.departureDate,
          options: slimAndCap(grouped.separateByLeg[i] || []),
        }))
        .filter((leg) => leg.route.length > 1), // skip empty form segments
      smartPackages: grouped.linkedLegGroups.map((g) => ({
        covers: g.label,
        options: slimAndCap(g.itineraries),
      })),
    },
    counts: {
      total: response.itineraries.length,
      roundTrip: grouped.singleTickets.length,
      mixAndMatch: grouped.separateByLeg.reduce((s, l) => s + l.length, 0),
      smartPackages: grouped.linkedLegGroups.reduce(
        (s, g) => s + g.itineraries.length,
        0
      ),
    },
  };
}

/**
 * Trigger a JSON file download in the browser.
 */
export function downloadSearchHistoryJson(
  history: SearchHistoryEntry[]
): void {
  const exportData: SearchHistoryExport = {
    exportedAt: new Date().toISOString(),
    sessionSearchCount: history.length,
    searches: history,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `flight-searches-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[T:]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
