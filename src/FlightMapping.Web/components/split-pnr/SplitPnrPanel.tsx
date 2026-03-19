"use client";

import { useState } from "react";
import { SplitPnrAnalysis } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import WaterfallVisualizer from "./WaterfallVisualizer";
import SplitConfigurator from "./SplitConfigurator";
import SplitComparison from "./SplitComparison";
import PassengerAssignment from "./PassengerAssignment";

interface Props {
  analysis: SplitPnrAnalysis;
  onClose: () => void;
  passengerNames?: string[];
}

type View = "comparison" | "waterfall" | "configurator" | "assign";

export default function SplitPnrPanel({ analysis, onClose, passengerNames }: Props) {
  const [view, setView] = useState<View>("comparison");

  const tabs: { key: View; label: string }[] = [
    { key: "comparison", label: "Compare Options" },
    { key: "waterfall", label: "Waterfall Detail" },
    { key: "configurator", label: "Customize Split" },
    { key: "assign", label: "Assign Passengers" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Split PNR Analysis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {analysis.carrier} · {analysis.route} · {analysis.cabin} ·{" "}
              {analysis.totalPassengers} passengers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-600">
                Save {formatCurrency(analysis.savings, "USD")}
              </div>
              <div className="text-xs text-gray-500">
                {Math.round(analysis.savingsPercent)}% savings
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 border-b border-gray-100 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                view === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "comparison" && <SplitComparison analysis={analysis} />}
          {view === "waterfall" && <WaterfallVisualizer waterfall={analysis.waterfall} />}
          {view === "configurator" && (
            <SplitConfigurator
              waterfall={analysis.waterfall}
              fareClasses={analysis.priceBreakpoints.map((bp) => ({
                rbd: bp.rbd,
                authCap: bp.inferredAuthCap,
                farePerPerson: bp.pricePerPerson,
                fareBasisCode: "",
                cabin: analysis.cabin,
              }))}
              totalPassengers={analysis.totalPassengers}
              groupCost={analysis.singleBooking.total}
            />
          )}
          {view === "assign" && (
            <PassengerAssignment
              pnrs={analysis.recommendedSplit.pnrs}
              passengerNames={passengerNames}
            />
          )}
        </div>
      </div>
    </div>
  );
}
