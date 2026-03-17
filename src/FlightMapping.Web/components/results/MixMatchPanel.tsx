"use client";
import { useState } from "react";
import { EnrichedItinerary, SegmentInput } from "@/lib/types";
import { LinkedLegGroup } from "@/lib/itineraryGrouping";
import { formatCurrency } from "@/lib/formatters";
import { groupByFlight } from "@/lib/itineraryGrouping2";
import { computeMinStopsPerSeg } from "@/lib/filterItineraries";
import MixMatchCard from "./MixMatchCard";
import SmartPackageCard from "./SmartPackageCard";

interface Props {
  legs: EnrichedItinerary[][];
  searchSegments: SegmentInput[];
  linkedLegGroups?: LinkedLegGroup[];
}

export default function MixMatchPanel({ legs, searchSegments, linkedLegGroups = [] }: Props) {
  // Per-leg individual OW selections
  const [selections, setSelections] = useState<(string | null)[]>(
    () => legs.map(() => null)
  );
  // Smart package selection
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageCoverage, setPackageCoverage] = useState<number[]>([]);

  const handleSelect = (legIdx: number, id: string) => {
    setSelections((prev) => {
      const next = [...prev];
      next[legIdx] = next[legIdx] === id ? null : id;
      return next;
    });
  };

  const handlePackageSelect = (itinId: string, coverage: number[]) => {
    if (selectedPackageId === itinId) {
      setSelectedPackageId(null);
      setPackageCoverage([]);
    } else {
      setSelectedPackageId(itinId);
      setPackageCoverage(coverage);
      // Clear individual selections for covered legs
      setSelections((prev) => {
        const next = [...prev];
        for (const idx of coverage) next[idx] = null;
        return next;
      });
    }
  };

  // Find the selected package itinerary
  const packageItin = selectedPackageId
    ? linkedLegGroups.flatMap((g) => g.itineraries).find((i) => i.id === selectedPackageId)
    : null;

  // Which legs still need individual selection?
  const uncoveredLegs = searchSegments
    .map((_, i) => i)
    .filter((i) => !packageCoverage.includes(i));

  // Are all required selections made?
  const allSelected = selectedPackageId
    ? uncoveredLegs.every((i) => selections[i] !== null)
    : selections.every((s) => s !== null);

  const selectedByLeg = selections.map((id, i) =>
    id ? legs[i]?.find((itin) => itin.id === id) : null
  );

  // Combined price calculation
  let combinedPerAdult: number | null = null;
  let combinedTotal: number | null = null;
  if (allSelected) {
    if (packageItin) {
      const owPerAdult = uncoveredLegs.reduce(
        (sum, i) => sum + (selectedByLeg[i]?.pricing.pricePerAdult ?? 0), 0
      );
      const owTotal = uncoveredLegs.reduce(
        (sum, i) => sum + (selectedByLeg[i]?.pricing.totalPrice ?? 0), 0
      );
      combinedPerAdult = packageItin.pricing.pricePerAdult + owPerAdult;
      combinedTotal = packageItin.pricing.totalPrice + owTotal;
    } else {
      combinedPerAdult = selectedByLeg.reduce(
        (sum, itin) => sum + (itin?.pricing.pricePerAdult ?? 0), 0
      );
      combinedTotal = selectedByLeg.reduce(
        (sum, itin) => sum + (itin?.pricing.totalPrice ?? 0), 0
      );
    }
  }

  const currency =
    legs[0]?.[0]?.pricing.currencyCode ||
    linkedLegGroups[0]?.itineraries[0]?.pricing.currencyCode ||
    "USD";

  const gridCols =
    legs.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : legs.length === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";

  const legLabel = (i: number) => {
    if (legs.length === 2 && linkedLegGroups.length === 0)
      return i === 0 ? "Outbound" : "Return";
    return `Leg ${i + 1}`;
  };

  return (
    <div>
      {/* Smart Packages section */}
      {linkedLegGroups.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-semibold text-gray-900">Smart Packages</div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Open-jaw round trip
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Combined round-trip fares covering multiple legs at once — often cheaper than buying separately.
          </p>
          {linkedLegGroups.map((group) => {
            const groups = groupByFlight(group.itineraries);
            const groupMinStops = computeMinStopsPerSeg(group.itineraries);
            return (
              <div key={group.coveredLegIndices.join(",")} className="mb-4">
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {groups.map((g) => {
                    const isSelected =
                      selectedPackageId === g.primary.id ||
                      g.variants.some((v) => selectedPackageId === v.id);
                    const uncoveredLegs = searchSegments
                      .map((seg, idx) => ({ seg, idx }))
                      .filter(({ seg, idx }) =>
                        !group.coveredLegIndices.includes(idx) &&
                        seg.origin.trim() !== "" &&
                        seg.destination.trim() !== ""
                      )
                      .map(({ seg }) => ({
                        origin: seg.origin,
                        destination: seg.destination,
                        date: seg.departureDate,
                      }));
                    return (
                      <SmartPackageCard
                        key={g.flightKey}
                        itinerary={g.primary}
                        variants={g.variants}
                        selected={isSelected}
                        onSelect={(id) =>
                          handlePackageSelect(id, group.coveredLegIndices)
                        }
                        coverageLabel={group.label}
                        uncoveredLegs={uncoveredLegs}
                        minStopsPerSeg={groupMinStops}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-leg columns */}
      <div className={`grid ${gridCols} gap-4`}>
        {legs.map((legItineraries, i) => {
          const isCovered = packageCoverage.includes(i);
          const groups = groupByFlight(legItineraries);
          return (
            <div key={i} className={isCovered ? "opacity-50 pointer-events-none" : ""}>
              {/* Column header */}
              <div className="mb-3">
                <div className="text-sm font-semibold text-gray-900">
                  {legLabel(i)}: {searchSegments[i]?.origin} → {searchSegments[i]?.destination}
                </div>
                <div className="text-xs text-gray-500">
                  {searchSegments[i]?.departureDate} · {groups.length} options
                </div>
                {isCovered && (
                  <div className="mt-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                    Covered by smart package
                  </div>
                )}
              </div>

              {/* Scrollable card list */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {groups.map((group) => (
                  <MixMatchCard
                    key={group.flightKey}
                    itinerary={group.primary}
                    variants={group.variants}
                    selected={
                      selections[i] === group.primary.id ||
                      group.variants.some((v) => selections[i] === v.id)
                    }
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
              {packageItin && (
                <span className="ml-2 text-xs text-blue-600">includes smart package</span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Total for all passengers: {formatCurrency(combinedTotal, currency)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center">
            {selectedPackageId
              ? "Select options for remaining legs to see the combined price"
              : "Select one option from each column to see the combined price"}
          </div>
        )}
      </div>
    </div>
  );
}
