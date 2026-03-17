"use client";

import { SplitPnrAnalysis } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  analysis: SplitPnrAnalysis;
}

export default function SplitComparison({ analysis }: Props) {
  const { singleBooking, recommendedSplit, totalPassengers, savings, savingsPercent, tradeOffs } = analysis;

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Option A: Single PNR */}
        <div className="rounded-xl border-2 border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Option A — Single PNR
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-700">
              {totalPassengers} x {singleBooking.rbd} class
              {singleBooking.brandName && (
                <span className="text-gray-500"> ({singleBooking.brandName})</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              @ {formatCurrency(singleBooking.pricePerPerson, "USD")}/person
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-3">
              {formatCurrency(singleBooking.total, "USD")}
            </div>
            <div className="text-xs text-gray-500">
              {formatCurrency(singleBooking.pricePerPerson, "USD")}/person
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Checkmark text="1 confirmation number" positive />
            <Checkmark text="Same rules for all passengers" positive />
            <Checkmark text="Group rebooking on disruption" positive />
            <Checkmark text="Easy to manage" positive />
          </div>
        </div>

        {/* Option B: Split PNRs */}
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/30 p-5 relative">
          <div className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            RECOMMENDED
          </div>
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">
            Option B — Split PNRs
          </div>

          <div className="space-y-2">
            {recommendedSplit.pnrs.map((pnr) => {
              // Show per-segment RBDs for roundtrips (e.g. "Z/I" instead of just "Z")
              const rbdLabel = pnr.segmentRbds && pnr.segmentRbds.length > 1
                ? pnr.segmentRbds.join("/")
                : pnr.rbd;
              return (
                <div key={pnr.pnrNumber} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    PNR {pnr.pnrNumber}: {pnr.passengerCount} x {rbdLabel}
                    {pnr.brandName && (
                      <span className="text-gray-400 text-xs ml-1">({pnr.brandName})</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    @ {formatCurrency(pnr.farePerPerson, "USD")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-2xl font-bold text-gray-900 mt-3">
            {formatCurrency(recommendedSplit.total, "USD")}
          </div>
          <div className="text-xs text-gray-500">
            avg {formatCurrency(recommendedSplit.averagePerPerson, "USD")}/person
          </div>

          <div className="mt-4 space-y-1.5">
            <Checkmark
              text={`Save ${formatCurrency(savings, "USD")} (${Math.round(savingsPercent)}%)`}
              positive
            />
            <Checkmark text="Same flight & cabin" positive />
            <Checkmark
              text={`${recommendedSplit.pnrs.length} confirmation numbers`}
              positive={false}
            />
            <Checkmark text="Mixed fare rules" positive={false} />
            <Checkmark text="Separate rebooking" positive={false} />
          </div>
        </div>
      </div>

      {/* Savings callout */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-6 py-3 rounded-xl">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-lg font-bold">
            SAVE {formatCurrency(savings, "USD")} ({Math.round(savingsPercent)}%)
          </span>
        </div>
      </div>

      {/* Per-person price visual */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Per-Person Price Breakdown
        </div>
        <div className="space-y-1.5">
          {recommendedSplit.pnrs.map((pnr) => {
            const widthPct = singleBooking.pricePerPerson > 0
              ? (pnr.farePerPerson / singleBooking.pricePerPerson) * 100
              : 100;
            const colors = [
              "bg-blue-500",
              "bg-indigo-500",
              "bg-purple-500",
              "bg-violet-500",
              "bg-fuchsia-500",
            ];

            return (
              <div key={pnr.pnrNumber} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600 text-right shrink-0">
                  {formatCurrency(pnr.farePerPerson, "USD")}
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md transition-all ${colors[(pnr.pnrNumber - 1) % colors.length]}`}
                    style={{ width: `${Math.min(widthPct, 100)}%` }}
                  />
                </div>
                <div className="w-28 text-xs text-gray-500 shrink-0">
                  {pnr.passengerCount} pax ({pnr.rbd})
                </div>
              </div>
            );
          })}
          {/* Group reference line */}
          <div className="flex items-center gap-3 opacity-50">
            <div className="w-20 text-xs text-gray-400 text-right shrink-0">
              {formatCurrency(singleBooking.pricePerPerson, "USD")}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
              <div className="h-full bg-gray-300 rounded-md w-full" />
            </div>
            <div className="w-28 text-xs text-gray-400 shrink-0">
              Group rate ({singleBooking.rbd})
            </div>
          </div>
        </div>
      </div>

      {/* Trade-offs */}
      {tradeOffs.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="text-xs font-semibold text-amber-800 mb-2">Trade-offs</div>
          <ul className="space-y-1">
            {tradeOffs.map((t, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Checkmark({ text, positive }: { text: string; positive: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {positive ? (
        <span className="text-emerald-500 font-bold">✓</span>
      ) : (
        <span className="text-amber-500 font-bold">!</span>
      )}
      <span className={positive ? "text-gray-700" : "text-gray-500"}>{text}</span>
    </div>
  );
}
