import { EnrichedItinerary, EnrichedSegment } from "./types";
import { FilterState, StopsFilter, TimeWindow, SortOption } from "./filterTypes";

/** Derive unique airline codes + counts from unfiltered results. */
export function extractAirlines(
  itineraries: EnrichedItinerary[]
): { code: string; count: number }[] {
  const map = new Map<string, number>();
  for (const itin of itineraries) {
    const carriers = new Set<string>();
    carriers.add(itin.validatingCarrier);
    for (const seg of itin.segments) {
      carriers.add(seg.marketingCarrier);
    }
    for (const code of carriers) {
      map.set(code, (map.get(code) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
}

function getTimeWindow(isoString: string): TimeWindow {
  const hour = new Date(isoString).getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "redeye";
}

function segmentPassesStops(seg: EnrichedSegment, stops: StopsFilter): boolean {
  switch (stops) {
    case "nonstop":
      return seg.stops === 0;
    case "up-to-1":
      return seg.stops <= 1;
    case "any":
      return true;
  }
}

function itineraryPassesAirlines(
  itin: EnrichedItinerary,
  airlines: Set<string>
): boolean {
  if (airlines.size === 0) return true;
  if (airlines.has(itin.validatingCarrier)) return true;
  return itin.segments.some((seg) => airlines.has(seg.marketingCarrier));
}

function segmentPassesTimeWindow(
  seg: EnrichedSegment,
  windows: Set<TimeWindow>
): boolean {
  if (windows.size === 0) return true;
  return windows.has(getTimeWindow(seg.departureTime));
}

/** Filter itineraries. For round-trips, ALL segments must pass stops/time. */
export function applyFilters(
  itineraries: EnrichedItinerary[],
  filters: FilterState
): EnrichedItinerary[] {
  return itineraries.filter((itin) => {
    // Stops: every segment must satisfy
    if (!itin.segments.every((seg) => segmentPassesStops(seg, filters.stops))) {
      return false;
    }

    // Airlines
    if (!itineraryPassesAirlines(itin, filters.airlines)) {
      return false;
    }

    // Max price
    if (filters.maxPrice !== null && itin.pricing.pricePerAdult > filters.maxPrice) {
      return false;
    }

    // Max duration
    if (
      filters.maxDurationMinutes !== null &&
      itin.totalDurationMinutes > filters.maxDurationMinutes
    ) {
      return false;
    }

    // Departure time windows per segment
    for (const [segIdx, windows] of filters.departureTimeWindows) {
      const seg = itin.segments[segIdx];
      if (seg && !segmentPassesTimeWindow(seg, windows)) {
        return false;
      }
    }

    return true;
  });
}

/** Sort filtered itineraries. Returns new array. */
export function applySorting(
  itineraries: EnrichedItinerary[],
  sortBy: SortOption
): EnrichedItinerary[] {
  const sorted = [...itineraries];
  switch (sortBy) {
    case "best":
      sorted.sort((a, b) => a.rank - b.rank);
      break;
    case "cheapest":
      sorted.sort((a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult);
      break;
    case "fastest":
      sorted.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
      break;
    case "fewest-stops": {
      sorted.sort((a, b) => {
        const stopsA = a.segments.reduce((s, seg) => s + seg.stops, 0);
        const stopsB = b.segments.reduce((s, seg) => s + seg.stops, 0);
        if (stopsA !== stopsB) return stopsA - stopsB;
        return a.rank - b.rank;
      });
      break;
    }
  }
  return sorted;
}

/** Filter then sort. */
export function filterAndSort(
  itineraries: EnrichedItinerary[],
  filters: FilterState
): EnrichedItinerary[] {
  return applySorting(applyFilters(itineraries, filters), filters.sortBy);
}
