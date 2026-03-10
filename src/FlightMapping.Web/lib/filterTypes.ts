export type StopsFilter = "any" | "nonstop" | "up-to-1";

export type SortOption = "best" | "cheapest" | "fastest" | "fewest-stops";

export type TimeWindow = "morning" | "afternoon" | "evening" | "redeye";

export interface FilterState {
  stops: StopsFilter;
  sortBy: SortOption;
  airlines: Set<string>; // empty = no filter (show all)
  maxPrice: number | null; // null = no limit; pricePerAdult
  maxDurationMinutes: number | null; // null = no limit
  departureTimeWindows: Map<number, Set<TimeWindow>>; // key = segment index
}

export const DEFAULT_FILTER_STATE: FilterState = {
  stops: "any",
  sortBy: "best",
  airlines: new Set(),
  maxPrice: null,
  maxDurationMinutes: null,
  departureTimeWindows: new Map(),
};

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.stops !== "any" ||
    filters.sortBy !== "best" ||
    filters.airlines.size > 0 ||
    filters.maxPrice !== null ||
    filters.maxDurationMinutes !== null ||
    filters.departureTimeWindows.size > 0
  );
}
