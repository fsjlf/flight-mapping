"use client";
import { useState } from "react";
import { EnrichedItinerary, SegmentInput } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { groupByFlight } from "@/lib/itineraryGrouping2";
import MixMatchCard from "./MixMatchCard";

interface Props {
  legs: EnrichedItinerary[][];
  searchSegments: SegmentInput[];
}

export default function MixMatchPanel({ legs, searchSegments }: Props) {
  const [selections, setSelections] = useState<(string | null)[]>(
    () => legs.map(() => null)
  );

  const handleSelect = (legIdx: number, id: string) => {
    setSelections((prev) => {
      const next = [...prev];
      next[legIdx] = next[legIdx] === id ? null : id;
      return next;
    });
  };

  const allSelected = selections.every((s) => s !== null);
  const selectedItineraries = selections.map((id, i) =>
    id ? legs[i].find((itin) => itin.id === id) : null
  );

  const combinedPerAdult = allSelected
    ? selectedItineraries.reduce(
        (sum, itin) => sum + (itin?.pricing.pricePerAdult ?? 0),
        0
      )
    : null;
  const combinedTotal = allSelected
    ? selectedItineraries.reduce(
        (sum, itin) => sum + (itin?.pricing.totalPrice ?? 0),
        0
      )
    : null;

  const currency =
    legs[0]?.[0]?.pricing.currencyCode ?? "USD";

  const gridCols =
    legs.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : legs.length === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";

  const legLabel = (i: number) => {
    if (legs.length === 2) return i === 0 ? "Outbound" : "Return";
    return `Leg ${i + 1}`;
  };

  return (
    <div>
      <div className={`grid ${gridCols} gap-4`}>
        {legs.map((legItineraries, i) => {
          const groups = groupByFlight(legItineraries);
          return (
            <div key={i}>
              {/* Column header */}
              <div className="mb-3">
                <div className="text-sm font-semibold text-gray-900">
                  {legLabel(i)}: {searchSegments[i]?.origin} → {searchSegments[i]?.destination}
                </div>
                <div className="text-xs text-gray-500">
                  {searchSegments[i]?.departureDate} · {groups.length} options
                </div>
              </div>

              {/* Scrollable card list */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {groups.map((group) => (
                  <MixMatchCard
                    key={group.flightKey}
                    itinerary={group.primary}
                    variants={group.variants}
                    selected={selections[i] === group.primary.id || group.variants.some((v) => selections[i] === v.id)}
                    onSelect={(id) => handleSelect(i, id)}
                  />
                ))}
                {groups.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-4">
                    No one-way options for this leg
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined price footer */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {allSelected && combinedPerAdult !== null && combinedTotal !== null ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Combined per person: </span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(combinedPerAdult, currency)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Total for all passengers: {formatCurrency(combinedTotal, currency)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center">
            Select one option from each column to see the combined price
          </div>
        )}
      </div>
    </div>
  );
}
