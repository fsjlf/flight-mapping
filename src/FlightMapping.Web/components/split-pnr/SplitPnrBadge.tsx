"use client";

import { SplitPnrDetection } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  detection: SplitPnrDetection;
  onShowOptions: () => void;
}

export default function SplitPnrBadge({ detection, onShowOptions }: Props) {
  if (!detection.opportunityDetected || detection.savingsBadge === "none") return null;

  const badgeColors =
    detection.savingsBadge === "green"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : "bg-amber-50 border-amber-200 text-amber-800";

  const iconColor =
    detection.savingsBadge === "green" ? "text-emerald-500" : "text-amber-500";

  const savingsRange =
    detection.minEstimatedSavings === detection.maxEstimatedSavings
      ? formatCurrency(detection.maxEstimatedSavings, "USD")
      : `${formatCurrency(detection.minEstimatedSavings, "USD")}–${formatCurrency(detection.maxEstimatedSavings, "USD")}`;

  const pctLow =
    detection.totalPassengers > 0
      ? (
          (detection.minEstimatedSavings /
            (detection.groupPricePerPerson * detection.totalPassengers)) *
          100
        ).toFixed(0)
      : "0";
  const pctHigh =
    detection.totalPassengers > 0
      ? (
          (detection.maxEstimatedSavings /
            (detection.groupPricePerPerson * detection.totalPassengers)) *
          100
        ).toFixed(0)
      : "0";
  const pctRange = pctLow === pctHigh ? `${pctHigh}%` : `${pctLow}–${pctHigh}%`;

  return (
    <div
      className={`mt-2 ml-12 rounded-lg border px-3 py-2 flex items-center gap-3 ${badgeColors}`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg className={`w-5 h-5 shrink-0 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">
          Split PNR savings available
        </div>
        <div className="text-[10px] opacity-80 mt-0.5">
          Est. {savingsRange} savings ({pctRange}) · {detection.singlePaxRbd} from{" "}
          {formatCurrency(detection.singlePaxPrice, "USD")}/pax vs{" "}
          {detection.groupRbd} at{" "}
          {formatCurrency(detection.groupPricePerPerson, "USD")}/pax
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onShowOptions();
        }}
        className={`text-[10px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
          detection.savingsBadge === "green"
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-amber-600 text-white hover:bg-amber-700"
        }`}
      >
        Show Split Options
      </button>
    </div>
  );
}
