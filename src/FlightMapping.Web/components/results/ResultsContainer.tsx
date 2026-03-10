"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { SearchResponse, SegmentInput } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { groupItineraries } from "@/lib/itineraryGrouping";
import { groupByFlight } from "@/lib/itineraryGrouping2";
import { FilterState, DEFAULT_FILTER_STATE } from "@/lib/filterTypes";
import { filterAndSort, extractAirlines } from "@/lib/filterItineraries";
import LoadingSpinner from "../ui/LoadingSpinner";
import FilterBar from "./FilterBar";
import RoundTripList from "./RoundTripList";
import MixMatchPanel from "./MixMatchPanel";
import ItineraryCard from "./ItineraryCard";

interface Props {
  response: SearchResponse | null;
  loading: boolean;
  error: string | null;
  searchSegments: SegmentInput[];
}

type ResultTab = "roundtrip" | "mixmatch";

export default function ResultsContainer({
  response,
  loading,
  error,
  searchSegments,
}: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>("roundtrip");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

  // Reset filters when new search results arrive
  const searchId = response?.metadata?.searchDurationMs;
  useEffect(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, [searchId, response]);

  const handleFilterChange = useCallback((update: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...update }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Search failed</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!response) return null;

  const { itineraries, metadata, classification } = response;

  if (itineraries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-700 font-medium">No results found</p>
        <p className="text-gray-500 text-sm mt-1">
          Try adjusting your search criteria.
        </p>
      </div>
    );
  }

  const grouped = groupItineraries(itineraries, searchSegments);
  const currency = itineraries[0]?.pricing.currencyCode || "USD";

  // Filter + sort
  const filteredSingleTickets = filterAndSort(grouped.singleTickets, filters);
  const filteredByLeg = grouped.separateByLeg.map((leg) =>
    filterAndSort(leg, filters)
  );

  // Grouped counts (unique flight combos after dedup)
  const groupedSingleTickets = groupByFlight(filteredSingleTickets);
  const groupedByLeg = filteredByLeg.map((leg) => groupByFlight(leg));
  const groupedSeparateCount = groupedByLeg.reduce(
    (s, l) => s + l.length,
    0
  );
  const totalFilteredCount = groupedSingleTickets.length + groupedSeparateCount;
  const totalUnfilteredCount =
    groupByFlight(grouped.singleTickets).length +
    grouped.separateByLeg.reduce((s, l) => s + groupByFlight(l).length, 0);

  // Cheapest after filtering (for comparison banner)
  const cheapestRT =
    filteredSingleTickets.length > 0
      ? Math.min(...filteredSingleTickets.map((i) => i.pricing.pricePerAdult))
      : null;
  const allFilteredLegsHaveOptions = filteredByLeg.every((l) => l.length > 0);
  const cheapestMM =
    allFilteredLegsHaveOptions && filteredByLeg.length > 0
      ? filteredByLeg.reduce(
          (sum, leg) =>
            sum +
            Math.min(...leg.map((i) => i.pricing.pricePerAdult)),
          0
        )
      : null;

  // Airlines + ranges from unfiltered data
  const airlines = extractAirlines(itineraries);
  const prices = itineraries.map((i) => i.pricing.pricePerAdult);
  const priceRange = { min: Math.min(...prices), max: Math.max(...prices) };
  const durations = itineraries.map((i) => i.totalDurationMinutes);
  const durationRange = {
    min: Math.min(...durations),
    max: Math.max(...durations),
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">
            {metadata.totalResults}
          </span>{" "}
          results
          <span className="mx-2 text-gray-300">|</span>
          {classification.type.replace(/([A-Z])/g, " $1").trim()}
          <span className="mx-2 text-gray-300">|</span>
          {metadata.strategiesExecuted} strategies
          <span className="mx-2 text-gray-300">|</span>
          {(metadata.searchDurationMs / 1000).toFixed(1)}s
        </div>
      </div>

      {grouped.showTabs ? (
        <>
          {/* Comparison banner */}
          <div className="flex flex-wrap gap-4 mb-3 p-3 bg-white border border-gray-200 rounded-lg text-sm">
            {cheapestRT !== null && (
              <div>
                <span className="text-gray-500">Cheapest round trip: </span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(cheapestRT, currency)}
                </span>
                <span className="text-gray-500">/person</span>
              </div>
            )}
            {cheapestMM !== null && (
              <>
                <span className="text-gray-300">|</span>
                <div>
                  <span className="text-gray-500">Cheapest mix & match: </span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(cheapestMM, currency)}
                  </span>
                  <span className="text-gray-500">/person</span>
                </div>
              </>
            )}
            {cheapestRT !== null && cheapestMM !== null && (
              <Savings rt={cheapestRT} mm={cheapestMM} currency={currency} />
            )}
          </div>

          {/* Filter bar */}
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            airlines={airlines}
            priceRange={priceRange}
            durationRange={durationRange}
            filteredCount={totalFilteredCount}
            totalCount={totalUnfilteredCount}
            searchSegments={searchSegments}
          />

          {/* Tab bar */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab("roundtrip")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "roundtrip"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Round Trip ({groupedSingleTickets.length})
            </button>
            <button
              onClick={() => setActiveTab("mixmatch")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "mixmatch"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Mix & Match ({groupedSeparateCount})
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "roundtrip" ? (
            <RoundTripList itineraries={filteredSingleTickets} />
          ) : (
            <MixMatchPanel
              legs={filteredByLeg}
              searchSegments={searchSegments}
            />
          )}
        </>
      ) : (
        /* Flat list for one-way or single-strategy results */
        <>
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            airlines={airlines}
            priceRange={priceRange}
            durationRange={durationRange}
            filteredCount={groupByFlight(filterAndSort(itineraries, filters)).length}
            totalCount={groupByFlight(itineraries).length}
            searchSegments={searchSegments}
          />
          <div className="space-y-3">
            {groupByFlight(filterAndSort(itineraries, filters)).map((group) => (
              <ItineraryCard key={group.flightKey} itinerary={group.primary} variants={group.variants} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Savings({
  rt,
  mm,
  currency,
}: {
  rt: number;
  mm: number;
  currency: string;
}) {
  const diff = Math.abs(rt - mm);
  if (diff < 1) return null;
  const label = rt < mm ? "RT saves" : "M&M saves";
  return (
    <span className="text-green-700 font-medium">
      ({label} {formatCurrency(diff, currency)})
    </span>
  );
}
