"use client";
import { useState } from "react";
import { EnrichedItinerary } from "@/lib/types";
import { formatTime, formatCurrency } from "@/lib/formatters";

interface Props {
  itinerary: EnrichedItinerary;
  variants?: EnrichedItinerary[];
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function MixMatchCard({ itinerary, variants, selected, onSelect }: Props) {
  const [showVariants, setShowVariants] = useState(false);
  const { segments, pricing, scores } = itinerary;
  const seg = segments[0];
  if (!seg) return null;

  const firstLeg = seg.legs[0];
  const lastLeg = seg.legs[seg.legs.length - 1];
  const stopsLabel =
    seg.stops === 0 ? "Nonstop" : `${seg.stops} stop${seg.stops > 1 ? "s" : ""}`;

  return (
    <div
      onClick={() => onSelect(itinerary.id)}
      className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      {/* Row 1: Route + price */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {seg.origin} → {seg.destination}
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

      {/* Row 2: Times + duration + stops */}
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        {firstLeg && <span>{formatTime(firstLeg.departureTime)}</span>}
        <span className="text-gray-300">→</span>
        {lastLeg && <span>{formatTime(lastLeg.arrivalTime)}</span>}
        <span className="text-gray-300">·</span>
        <span>{seg.durationFormatted}</span>
        <span className="text-gray-300">·</span>
        <span>{stopsLabel}</span>
      </div>

      {/* Row 3: Carrier + cabin */}
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{seg.flightNumber}</span>
        <span className="text-gray-300">·</span>
        <span>{seg.cabin} ({seg.bookingClass})</span>
        {itinerary.farePolicy.nonRefundable && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-amber-600">Non-ref</span>
          </>
        )}
      </div>

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
            {showVariants ? "Hide" : `+${variants.length} fare${variants.length > 1 ? "s" : ""}`}
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
                    {v.segments[0]?.brand?.name ?? `${v.validatingCarrier} ${v.segments[0]?.bookingClass}`}
                    {" · "}
                    {v.segments[0]?.cabin}
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
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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
