"use client";

import { useState } from "react";
import { WaterfallResult, WaterfallSnapshot, ClassSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  waterfall: WaterfallResult;
}

export default function WaterfallVisualizer({ waterfall }: Props) {
  const { snapshots, allocations } = waterfall;
  const [stepIdx, setStepIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  // Handle empty snapshots (backend detection without full waterfall data)
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm font-medium">Waterfall visualization not available</p>
          <p className="text-xs mt-1">
            Detailed step-by-step waterfall data requires a full analysis.
            The split PNR recommendation above is based on incremental fare probing.
          </p>
        </div>
        {allocations.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Allocation Summary</h4>
            {allocations.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{a.rbd}</span>
                  <span className="text-sm text-gray-700">{a.count} pax × {formatCurrency(a.farePerPerson, "USD")}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(a.subtotal, "USD")}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-300">
              <span className="text-sm font-bold text-gray-700">Split Total</span>
              <span className="text-sm font-bold text-green-700">{formatCurrency(waterfall.totalCost, "USD")}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-500">vs Group Rate</span>
              <span className="text-sm text-gray-500 line-through">{formatCurrency(waterfall.groupCost, "USD")}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const current = snapshots[stepIdx];
  const prev = stepIdx > 0 ? snapshots[stepIdx - 1] : null;
  const totalSteps = snapshots.length;

  // Find the max auth cap for scaling bars
  const maxAuth = Math.max(
    ...snapshots.flatMap((s) => s.classes.map((c) => c.authRemaining)),
    ...snapshots.map((s) => s.physicalRemaining),
  );
  const barScale = maxAuth > 0 ? maxAuth : 1;

  // Auto-play timer
  const handleAutoPlay = () => {
    if (autoPlay) {
      setAutoPlay(false);
      return;
    }
    setAutoPlay(true);
    let idx = stepIdx;
    const interval = setInterval(() => {
      idx++;
      if (idx >= totalSteps) {
        clearInterval(interval);
        setAutoPlay(false);
        return;
      }
      setStepIdx(idx);
    }, 1200);
  };

  // Track which classes changed this step
  const changedRbds = new Set<string>();
  if (prev) {
    for (const cls of current.classes) {
      const prevCls = prev.classes.find((c) => c.rbd === cls.rbd);
      if (prevCls && prevCls.effectiveAvailable !== cls.effectiveAvailable) {
        changedRbds.add(cls.rbd);
      }
    }
  }

  // Running allocation totals up to this step
  const runningTotal = allocations
    .slice(0, stepIdx)
    .reduce((sum, a) => sum + a.subtotal, 0);
  const projectedTotal = waterfall.totalCost;

  return (
    <div className="space-y-5">
      {/* Step controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <span className="text-xs font-medium text-gray-600">
            Step {stepIdx} of {totalSteps - 1}:
          </span>{" "}
          <span className="text-xs font-bold text-gray-900">{current.label}</span>
        </div>

        <button
          onClick={() => setStepIdx(Math.min(totalSteps - 1, stepIdx + 1))}
          disabled={stepIdx === totalSteps - 1}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={handleAutoPlay}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            autoPlay
              ? "bg-red-100 text-red-700 border border-red-200"
              : "bg-blue-100 text-blue-700 border border-blue-200"
          }`}
        >
          {autoPlay ? "Stop" : "Auto Play"}
        </button>
      </div>

      {/* Physical seats bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Physical Seats Remaining
          </span>
          <span className="text-xs font-bold text-gray-700">
            {current.physicalRemaining}
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(current.physicalRemaining / barScale) * 100}%` }}
          />
        </div>
      </div>

      {/* Class availability table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-right">Fare</th>
              <th className="px-3 py-2 text-center">Auth</th>
              <th className="px-3 py-2 text-center">Phys</th>
              <th className="px-3 py-2 text-center">Avail</th>
              <th className="px-3 py-2 text-center">Constraint</th>
              <th className="px-3 py-2 w-40">Availability</th>
            </tr>
          </thead>
          <tbody>
            {current.classes.map((cls) => {
              const changed = changedRbds.has(cls.rbd);
              const prevCls = prev?.classes.find((c) => c.rbd === cls.rbd);
              const delta = prevCls ? cls.effectiveAvailable - prevCls.effectiveAvailable : 0;
              const soldOut = cls.effectiveAvailable === 0;

              return (
                <tr
                  key={cls.rbd}
                  className={`border-t border-gray-100 transition-colors duration-300 ${
                    changed ? "bg-amber-50" : soldOut ? "bg-gray-50 opacity-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-gray-900">{cls.rbd}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {formatCurrency(cls.fare, "USD")}
                  </td>
                  <td className="px-3 py-2 text-center font-mono">{cls.authRemaining}</td>
                  <td className="px-3 py-2 text-center font-mono">{cls.physicalRemaining}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold">
                    {cls.effectiveAvailable}
                    {delta !== 0 && (
                      <span className={`ml-1 text-[9px] ${delta < 0 ? "text-red-500" : "text-green-500"}`}>
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        cls.bindingConstraint === "cap"
                          ? "bg-purple-100 text-purple-700"
                          : cls.bindingConstraint === "physical"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {cls.bindingConstraint}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <AvailBar cls={cls} maxAuth={barScale} changed={changed} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Allocation train */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Allocation Progress
        </div>
        <div className="flex gap-2">
          {allocations.map((alloc, i) => {
            const isComplete = i < stepIdx;
            const isNext = i === stepIdx;
            return (
              <div
                key={i}
                className={`flex-1 rounded-lg border-2 p-2.5 text-center transition-all duration-300 ${
                  isComplete
                    ? "border-emerald-300 bg-emerald-50"
                    : isNext
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="font-bold text-sm text-gray-900">
                  {alloc.count} x {alloc.rbd}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {formatCurrency(alloc.subtotal, "USD")}
                </div>
                <div className="text-[9px] mt-1">
                  {isComplete ? (
                    <span className="text-emerald-600 font-medium">Done</span>
                  ) : isNext ? (
                    <span className="text-blue-600 font-medium">Next</span>
                  ) : (
                    <span className="text-gray-400">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-500 mt-2 text-right">
          Running total: {formatCurrency(runningTotal, "USD")} / {formatCurrency(projectedTotal, "USD")} projected
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-blue-500 rounded-sm inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-gray-200 rounded-sm inline-block" /> Consumed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-amber-100 rounded-sm inline-block" /> Changed this step
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[8px]">cap</span> Auth binding
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[8px]">physical</span> Seat binding
        </span>
      </div>
    </div>
  );
}

function AvailBar({ cls, maxAuth, changed }: { cls: ClassSnapshot; maxAuth: number; changed: boolean }) {
  const authPct = (cls.authRemaining / maxAuth) * 100;
  const physPct = (cls.physicalRemaining / maxAuth) * 100;
  const availPct = (cls.effectiveAvailable / maxAuth) * 100;

  return (
    <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
      {/* Physical capacity (light background) */}
      <div
        className="absolute inset-y-0 left-0 bg-gray-200 rounded transition-all duration-500"
        style={{ width: `${physPct}%` }}
      />
      {/* Available (effective = min of auth, physical) */}
      <div
        className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${
          changed ? "bg-amber-400" : cls.effectiveAvailable === 0 ? "bg-gray-300" : "bg-blue-500"
        }`}
        style={{ width: `${availPct}%` }}
      />
      {cls.effectiveAvailable === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-500">
          SOLD OUT
        </div>
      )}
    </div>
  );
}
