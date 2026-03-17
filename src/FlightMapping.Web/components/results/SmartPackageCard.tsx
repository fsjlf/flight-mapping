"use client";
import { useState } from "react";
import { EnrichedItinerary } from "@/lib/types";
import { formatTime, formatCurrency } from "@/lib/formatters";

interface UncoveredLeg {
  origin: string;
  destination: string;
  date: string;
}

interface Props {
  itinerary: EnrichedItinerary;
  variants?: EnrichedItinerary[];
  selected: boolean;
  onSelect: (id: string) => void;
  coverageLabel: string;
  uncoveredLegs?: UncoveredLeg[];
  /** Min achievable stops per segment position across all itineraries in the group. */
  minStopsPerSeg?: number[];
}

export default function SmartPackageCard({
  itinerary,
  variants,
  selected,
  onSelect,
  coverageLabel,
  uncoveredLegs,
  minStopsPerSeg,
}: Props) {
  const [showVariants, setShowVariants] = useState(false);
  const { segments, pricing, scores } = itinerary;

  return (
    <div
      onClick={() => onSelect(itinerary.id)}
      className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      {/* Header: package label + score + price */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {coverageLabel}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${scoreStyle(scores.overall)}`}
          >
            {scores.overall.toFixed(0)}
          </span>
          <span className="text-sm font-bold text-gray-900">
            {formatCurrency(pricing.pricePerAdult, pricing.currencyCode)}
          </span>
        </div>
      </div>

      {/* Segments + uncovered legs interleaved */}
      <div className="space-y-2">
        {buildSegmentSequence(segments, uncoveredLegs).map((item, i) => {
          if (item.type === "uncovered") {
            return (
              <div
                key={`unc-${i}`}
                className="border-l-2 border-dashed border-gray-300 pl-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    {item.origin} → {item.destination}
                  </span>
                  <span className="text-[10px] text-gray-400">{item.date}</span>
                </div>
                <div className="text-[10px] text-amber-600 font-medium">
                  Select separately below
                </div>
              </div>
            );
          }
          const seg = item.segment!;
          const segIdx = item.segIndex ?? 0;
          const firstLeg = seg.legs[0];
          const lastLeg = seg.legs[seg.legs.length - 1];
          const stopsLabel =
            seg.stops === 0
              ? "Nonstop"
              : `${seg.stops} stop${seg.stops > 1 ? "s" : ""}`;
          const noNonstop =
            minStopsPerSeg && segIdx < minStopsPerSeg.length && minStopsPerSeg[segIdx] > 0;
          return (
            <div key={i} className="border-l-2 border-blue-300 pl-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {seg.origin} → {seg.destination}
                </span>
                <span className="text-[10px] text-gray-400">
                  {seg.cabin} ({seg.bookingClass})
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {firstLeg && <span>{formatTime(firstLeg.departureTime)}</span>}
                <span className="text-gray-300">→</span>
                {lastLeg && <span>{formatTime(lastLeg.arrivalTime)}</span>}
                <span className="text-gray-300">·</span>
                <span>{seg.durationFormatted}</span>
                <span className="text-gray-300">·</span>
                <span>{stopsLabel}</span>
                {noNonstop && (
                  <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    No nonstop avail
                  </span>
                )}
                <span className="text-gray-300">·</span>
                <span>{seg.flightNumber}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Refund info */}
      {itinerary.farePolicy.nonRefundable && (
        <div className="mt-2 text-[10px] text-amber-600">Non-refundable</div>
      )}

      {/* Variant fares */}
      {variants && variants.length > 0 && (
        <div className="mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowVariants(!showVariants);
            }}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
          >
            {showVariants
              ? "Hide"
              : `+${variants.length} fare${variants.length > 1 ? "s" : ""}`}
          </button>
          {showVariants && (
            <div className="mt-1 border-t border-gray-100 pt-1 space-y-0.5">
              {variants.map((v) => (
                <div
                  key={v.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(v.id);
                  }}
                  className="flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  <span>
                    {v.validatingCarrier}{" · "}
                    {v.segments.map((s) => `${s.cabin}(${s.bookingClass})`).join(" + ")}
                  </span>
                  <span className="font-medium text-gray-700">
                    {formatCurrency(v.pricing.pricePerAdult, v.pricing.currencyCode)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div className="flex justify-end mt-1">
          <svg
            className="w-4 h-4 text-blue-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function scoreStyle(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  if (score >= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

interface SequenceItem {
  type: "covered" | "uncovered";
  segment?: EnrichedItinerary["segments"][number];
  segIndex?: number;
  origin?: string;
  destination?: string;
  date?: string;
}

/**
 * Interleave covered segments with uncovered leg placeholders.
 * Uses destination→origin chaining to insert uncovered legs in order.
 */
function buildSegmentSequence(
  segments: EnrichedItinerary["segments"],
  uncoveredLegs?: UncoveredLeg[]
): SequenceItem[] {
  if (!uncoveredLegs || uncoveredLegs.length === 0) {
    return segments.map((s, i) => ({ type: "covered", segment: s, segIndex: i }));
  }

  const result: SequenceItem[] = [];
  const remaining = [...uncoveredLegs];

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    // Insert any uncovered legs that connect before this segment
    const matchIdx = remaining.findIndex(
      (u) => u.destination.toUpperCase() === seg.origin.toUpperCase()
    );
    if (matchIdx >= 0) {
      result.push({
        type: "uncovered",
        origin: remaining[matchIdx].origin,
        destination: remaining[matchIdx].destination,
        date: remaining[matchIdx].date,
      });
      remaining.splice(matchIdx, 1);
    }
    result.push({ type: "covered", segment: seg, segIndex: si });
  }

  // Append any remaining uncovered legs at the end
  for (const u of remaining) {
    result.push({ type: "uncovered", origin: u.origin, destination: u.destination, date: u.date });
  }

  return result;
}
