"use client";
import { useState } from "react";
import { EnrichedItinerary } from "@/lib/types";
import { formatTime, formatCurrency } from "@/lib/formatters";
import Badge from "../ui/Badge";
import ItineraryDetail from "./ItineraryDetail";

interface Props {
  itinerary: EnrichedItinerary;
  variants?: EnrichedItinerary[];
  /** Min achievable stops per segment position across all itineraries. */
  minStopsPerSeg?: number[];
}

export default function ItineraryCard({ itinerary, variants, minStopsPerSeg }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const { segments, pricing, scores, strategyType } = itinerary;

  const firstLeg = segments[0]?.legs[0];
  const lastSeg = segments[segments.length - 1];
  const lastLeg = lastSeg?.legs[lastSeg.legs.length - 1];

  const route = segments.map((s) => s.origin).join(" → ") + ` → ${lastSeg?.destination ?? ""}`;

  const totalStops = segments.reduce((sum, s) => sum + s.stops, 0);
  const stopsLabel =
    totalStops === 0 ? "Nonstop" : `${totalStops} stop${totalStops > 1 ? "s" : ""}`;

  // Check if any segment has no nonstop option available
  const hasNoNonstopSegs = minStopsPerSeg
    ? segments.some((seg, i) => seg.stops > 0 && minStopsPerSeg[i] > 0)
    : false;

  return (
    <div
      className={`bg-white rounded-xl border transition-shadow cursor-pointer ${
        expanded
          ? "border-blue-300 shadow-md"
          : "border-gray-200 shadow-sm hover:shadow-md"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        {/* Collapsed summary row */}
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="text-lg font-bold text-gray-300 w-8 text-center shrink-0">
            {itinerary.rank}
          </div>

          {/* Route + times */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {route}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {firstLeg && (
                <span>{formatTime(firstLeg.departureTime)}</span>
              )}
              <span className="text-gray-300">→</span>
              {lastLeg && <span>{formatTime(lastLeg.arrivalTime)}</span>}
              <span className="text-gray-300">·</span>
              <span>{itinerary.totalDurationFormatted}</span>
              <span className="text-gray-300">·</span>
              <span>{stopsLabel}</span>
              {hasNoNonstopSegs && (
                <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  No nonstop avail on {segments
                    .map((seg, i) => (minStopsPerSeg && minStopsPerSeg[i] > 0 ? `${seg.origin}→${seg.destination}` : null))
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              <span className="text-gray-300">·</span>
              <span>{itinerary.validatingCarrier}</span>
            </div>
          </div>

          {/* Score pill */}
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${scoreStyle(scores.overall)}`}
          >
            {scores.overall.toFixed(0)}
          </div>

          {/* Price */}
          <div className="text-right shrink-0 w-24">
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(pricing.pricePerAdult, pricing.currencyCode)}
            </div>
            <div className="text-xs text-gray-500">per person</div>
          </div>

          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
          <Badge text={strategyType.replace(/([A-Z])/g, " $1").trim()} variant="strategy" />
          {segments.map((s, i) => (
            <Badge
              key={i}
              text={`${s.cabin} (${s.bookingClass})`}
              variant="info"
            />
          ))}
          {itinerary.farePolicy.nonRefundable && (
            <Badge text="Non-refundable" variant="warning" />
          )}
        </div>

        {/* Fare options grid */}
        {variants && variants.length > 0 && (
          <div className="ml-12 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVariants(!showVariants);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {showVariants
                ? "Hide fare options"
                : `${variants.length + 1} fare option${variants.length > 0 ? "s" : ""} from ${formatCurrency(
                    Math.min(pricing.pricePerAdult, ...variants.map((v) => v.pricing.pricePerAdult)),
                    pricing.currencyCode
                  )}`}
            </button>

            {showVariants && (
              <FareGrid
                allFares={[itinerary, ...variants]}
                currentId={itinerary.id}
                primaryCarrier={itinerary.validatingCarrier}
              />
            )}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && <ItineraryDetail itinerary={itinerary} />}
      </div>
    </div>
  );
}

function scoreStyle(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  if (score >= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

/* ─── Fare Grid ─── */

const CABIN_ORDER = ["Economy", "PremiumEconomy", "Business", "First"] as const;
const CABIN_LABELS: Record<string, string> = {
  Economy: "Economy",
  PremiumEconomy: "Premium Economy",
  Business: "Business",
  First: "First",
};

function getFareLabel(itin: EnrichedItinerary): string {
  const brand = itin.segments[0]?.brand;
  if (brand?.name) return brand.name;
  // Fallback: carrier + booking class
  return `${itin.validatingCarrier} ${itin.segments.map((s) => s.bookingClass).join("/")}`;
}

function getPolicyLabel(itin: EnrichedItinerary): string {
  const parts: string[] = [];
  if (itin.farePolicy.nonRefundable) parts.push("Non-refundable");
  else parts.push("Fully Refundable");

  // Check brand features for change policy
  const brand = itin.segments[0]?.brand;
  if (brand?.features) {
    const changeFeat = brand.features.find(
      (f) => f.name.toLowerCase().includes("change") || f.name.toLowerCase().includes("cancel")
    );
    if (changeFeat) {
      parts.push(changeFeat.application ?? changeFeat.name);
    }
  }
  return parts.join(" / ");
}

function getPrimaryCabin(itin: EnrichedItinerary): string {
  return itin.segments[0]?.cabin ?? "Economy";
}

/* ─── Amenity extraction ─── */

interface Amenity {
  label: string;
  status: "included" | "chargeable" | "unavailable";
}

/** Map Sabre application codes to display status */
function appStatus(code?: string): "included" | "chargeable" | "unavailable" {
  if (code === "F") return "included";     // Free
  if (code === "C") return "chargeable";   // Chargeable
  return "unavailable";                     // N = not offered, D = depends/not applicable
}

/** Rank statuses so we can pick the most favorable one */
const STATUS_RANK: Record<string, number> = {
  included: 3,
  chargeable: 2,
  unavailable: 1,
};

const STATUS_ICON: Record<string, string> = {
  included: "✓",
  chargeable: "$",
  unavailable: "✗",
};

const STATUS_STYLE: Record<string, string> = {
  included: "text-green-600",
  chargeable: "text-amber-600",
  unavailable: "text-gray-300",
};

/** Find ALL features matching keywords, return the one with the best (most favorable) status */
function findBest(
  features: { name: string; application?: string; serviceGroup?: string }[],
  keywords: string[],
  serviceGroup?: string
): { name: string; application?: string; serviceGroup?: string } | undefined {
  const matches = features.filter((f) => {
    const name = f.name.toLowerCase();
    const matchesKeyword = keywords.some((kw) => name.includes(kw));
    const matchesGroup = !serviceGroup || f.serviceGroup === serviceGroup;
    return matchesKeyword && matchesGroup;
  });
  if (matches.length === 0) return undefined;
  // Pick the match with the most favorable application status (F > C > D/N)
  return matches.reduce((best, cur) => {
    const bestRank = STATUS_RANK[appStatus(best.application)] ?? 0;
    const curRank = STATUS_RANK[appStatus(cur.application)] ?? 0;
    return curRank > bestRank ? cur : best;
  });
}

/** Extract the most useful amenities from brand features */
function extractAmenities(itin: EnrichedItinerary): Amenity[] {
  const features = itin.segments[0]?.brand?.features;
  if (!features || features.length === 0) return [];

  const amenities: Amenity[] = [];

  // Checked bags
  const bag = findBest(features, ["1st bag", "checked bag 1pc", "checked bag"], "BG")
    ?? findBest(features, ["bag"], "BG");
  if (bag) {
    const status = appStatus(bag.application);
    const label = status === "unavailable" ? "No checked bag" : "Checked bag";
    amenities.push({ label, status });
  }

  // Seat selection
  const seat = findBest(features, ["seat selection", "advance seat", "preferred seat"], "SA")
    ?? findBest(features, ["seat selection", "preferred seat"], "BF");
  if (seat) {
    amenities.push({ label: "Seat selection", status: appStatus(seat.application) });
  }

  // Changes — look across all change-related features
  const change = findBest(features, ["change before", "change after", "change"]);
  if (change) {
    amenities.push({ label: "Changes", status: appStatus(change.application) });
  }

  // Cancellation / Refund — find best across all cancel/refund features
  const cancel = findBest(features, ["cancel", "refund", "ecredit"]);
  if (cancel) {
    amenities.push({ label: "Cancellation", status: appStatus(cancel.application) });
  }

  // Meals
  const meal = findBest(features, ["meal", "snack", "food"], "ML");
  if (meal) {
    amenities.push({ label: "Meal", status: appStatus(meal.application) });
  }

  // WiFi
  const wifi = findBest(features, ["wifi", "wi-fi", "internet"], "IE");
  if (wifi) {
    amenities.push({ label: "WiFi", status: appStatus(wifi.application) });
  }

  // Priority boarding
  const priority = findBest(features, ["priority boarding"], "TS");
  if (priority) {
    amenities.push({ label: "Priority boarding", status: appStatus(priority.application) });
  }

  // Lounge
  const lounge = findBest(features, ["lounge"], "LG");
  if (lounge) {
    amenities.push({ label: "Lounge", status: appStatus(lounge.application) });
  }

  return amenities;
}

function FareGrid({
  allFares,
  currentId,
  primaryCarrier,
}: {
  allFares: EnrichedItinerary[];
  currentId: string;
  primaryCarrier: string;
}) {
  const [selectedCarrier, setSelectedCarrier] = useState<string>(primaryCarrier);

  // Group by validating carrier
  const carrierMap = new Map<string, EnrichedItinerary[]>();
  for (const fare of allFares) {
    const carrier = fare.validatingCarrier;
    const group = carrierMap.get(carrier);
    if (group) group.push(fare);
    else carrierMap.set(carrier, [fare]);
  }

  // Sort carriers: primary first, then alphabetically
  const carriers = [...carrierMap.keys()].sort((a, b) => {
    if (a === primaryCarrier) return -1;
    if (b === primaryCarrier) return 1;
    return a.localeCompare(b);
  });

  const activeFares = carrierMap.get(selectedCarrier) ?? allFares;

  // Group active fares by cabin
  const cabinGroups = new Map<string, EnrichedItinerary[]>();
  for (const fare of activeFares) {
    const cabin = getPrimaryCabin(fare);
    const group = cabinGroups.get(cabin);
    if (group) group.push(fare);
    else cabinGroups.set(cabin, [fare]);
  }

  const sortedCabins = [...cabinGroups.entries()].sort(
    (a, b) =>
      CABIN_ORDER.indexOf(a[0] as (typeof CABIN_ORDER)[number]) -
      CABIN_ORDER.indexOf(b[0] as (typeof CABIN_ORDER)[number])
  );

  const currency = allFares[0]?.pricing.currencyCode ?? "USD";

  return (
    <div
      className="mt-2 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Carrier filter tabs */}
      {carriers.length > 1 && (
        <div className="flex items-center gap-1.5">
          {carriers.map((carrier) => {
            const count = carrierMap.get(carrier)?.length ?? 0;
            const isActive = carrier === selectedCarrier;
            return (
              <button
                key={carrier}
                onClick={() => setSelectedCarrier(carrier)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {carrier} ({count})
              </button>
            );
          })}
        </div>
      )}

      {sortedCabins.map(([cabin, fares]) => (
        <div key={cabin}>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {CABIN_LABELS[cabin] ?? cabin}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fares
              .sort((a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult)
              .map((fare) => {
                const amenities = extractAmenities(fare);
                return (
                  <div
                    key={fare.id}
                    className={`rounded-lg border p-3 text-xs ${
                      fare.id === currentId
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-900 text-xs leading-tight">
                      {getFareLabel(fare)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {CABIN_LABELS[getPrimaryCabin(fare)] ?? getPrimaryCabin(fare)}
                    </div>

                    {/* Amenities */}
                    {amenities.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {amenities.map((a) => (
                          <div key={a.label} className="flex items-center gap-1.5 text-[10px]">
                            <span className={`font-mono text-[9px] w-3 text-center ${STATUS_STYLE[a.status]}`}>
                              {STATUS_ICON[a.status]}
                            </span>
                            <span className={a.status === "unavailable" ? "text-gray-300 line-through" : "text-gray-600"}>
                              {a.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="font-bold text-gray-900 mt-2">
                      {formatCurrency(fare.pricing.pricePerAdult, currency)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
