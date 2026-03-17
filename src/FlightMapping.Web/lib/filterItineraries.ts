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

/**
 * Compute the minimum achievable stops for each segment position
 * across a pool of itineraries. Returns an array where
 * minStops[i] = minimum stops any itinerary has for segment index i.
 */
export function computeMinStopsPerSeg(
  itineraries: EnrichedItinerary[]
): number[] {
  if (itineraries.length === 0) return [];
  const segCount = itineraries[0].segments.length;
  const mins = new Array(segCount).fill(Infinity);
  for (const itin of itineraries) {
    for (let i = 0; i < itin.segments.length; i++) {
      mins[i] = Math.min(mins[i], itin.segments[i].stops);
    }
  }
  return mins.map((v) => (v === Infinity ? 0 : v));
}

/** Filter then sort. */
export function filterAndSort(
  itineraries: EnrichedItinerary[],
  filters: FilterState
): EnrichedItinerary[] {
  return applySorting(applyFilters(itineraries, filters), filters.sortBy);
}

/**
 * Smart stop filter for linked packages (smart packages).
 *
 * Instead of requiring every segment to pass the stop filter,
 * we compute the minimum achievable stops per segment position
 * across all itineraries in the group. If the filter is "nonstop"
 * but no itinerary in the group has 0 stops for segment position N,
 * we relax the requirement for that position to the minimum available.
 *
 * Result: "nonstop" means "nonstop where possible, fewest stops otherwise."
 */
export function filterAndSortSmartPackages(
  itineraries: EnrichedItinerary[],
  filters: FilterState
): EnrichedItinerary[] {
  if (filters.stops === "any" || itineraries.length === 0) {
    return filterAndSort(itineraries, filters);
  }

  // Compute minimum stops achievable per segment position
  const segCount = itineraries[0].segments.length;
  const minStopsPerSeg: number[] = new Array(segCount).fill(Infinity);
  for (const itin of itineraries) {
    for (let i = 0; i < itin.segments.length; i++) {
      minStopsPerSeg[i] = Math.min(minStopsPerSeg[i], itin.segments[i].stops);
    }
  }

  // Derive per-segment allowed stops based on filter + availability
  const allowedStopsPerSeg: number[] = minStopsPerSeg.map((minAvail) => {
    if (filters.stops === "nonstop") {
      // Require nonstop if available, otherwise allow the minimum
      return Math.max(minAvail, 0);
    }
    // "up-to-1": allow ≤1 if available, otherwise allow the minimum
    return Math.max(minAvail, 0) <= 1 ? 1 : minAvail;
  });

  // Filter using per-segment allowances for stops, standard rules for everything else
  const filtered = itineraries.filter((itin) => {
    // Smart per-segment stops check
    for (let i = 0; i < itin.segments.length; i++) {
      if (itin.segments[i].stops > allowedStopsPerSeg[i]) {
        return false;
      }
    }

    // Standard checks (airlines, price, duration, time)
    if (!itineraryPassesAirlines(itin, filters.airlines)) return false;
    if (filters.maxPrice !== null && itin.pricing.pricePerAdult > filters.maxPrice) return false;
    if (filters.maxDurationMinutes !== null && itin.totalDurationMinutes > filters.maxDurationMinutes) return false;
    for (const [segIdx, windows] of filters.departureTimeWindows) {
      const seg = itin.segments[segIdx];
      if (seg && !segmentPassesTimeWindow(seg, windows)) return false;
    }
    return true;
  });

  // Sort with total stops as a tiebreaker for "best" sort
  return applySortingWithStops(filtered, filters.sortBy);
}

/** Sort with total stops as a secondary tiebreaker (fewer stops preferred). */
function applySortingWithStops(
  itineraries: EnrichedItinerary[],
  sortBy: SortOption
): EnrichedItinerary[] {
  const sorted = [...itineraries];
  const totalStops = (it: EnrichedItinerary) =>
    it.segments.reduce((s, seg) => s + seg.stops, 0);

  switch (sortBy) {
    case "best":
      sorted.sort((a, b) => {
        const stopsA = totalStops(a);
        const stopsB = totalStops(b);
        if (stopsA !== stopsB) return stopsA - stopsB;
        return a.rank - b.rank;
      });
      break;
    case "cheapest":
      sorted.sort((a, b) => {
        const priceDiff = a.pricing.pricePerAdult - b.pricing.pricePerAdult;
        if (Math.abs(priceDiff) > 1) return priceDiff;
        return totalStops(a) - totalStops(b);
      });
      break;
    case "fastest":
      sorted.sort((a, b) => {
        const durDiff = a.totalDurationMinutes - b.totalDurationMinutes;
        if (durDiff !== 0) return durDiff;
        return totalStops(a) - totalStops(b);
      });
      break;
    case "fewest-stops":
      sorted.sort((a, b) => {
        const stopsDiff = totalStops(a) - totalStops(b);
        if (stopsDiff !== 0) return stopsDiff;
        return a.rank - b.rank;
      });
      break;
  }
  return sorted;
}
