"use client";

import { useState, useMemo, useCallback } from "react";
import { FareClassInfo, WaterfallResult, WaterfallSnapshot, ClassSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  waterfall: WaterfallResult;
  fareClasses: Omit<FareClassInfo, "cabin">[];
  totalPassengers: number;
  groupCost: number;
}

/**
 * Client-side waterfall recalculation for real-time slider feedback.
 * Mirrors the backend WaterfallCalculator logic.
 */
function recalcWaterfall(
  classes: Omit<FareClassInfo, "cabin">[],
  allocations: Record<string, number>,
  physicalSeats: number,
  groupCost: number,
  totalPassengers: number,
): WaterfallResult {
  const sorted = [...classes].sort((a, b) => a.farePerPerson - b.farePerPerson);
  const authRemaining: Record<string, number> = {};
  sorted.forEach((c) => (authRemaining[c.rbd] = c.authCap));

  let physRemaining = physicalSeats;
  const resultAllocations: { rbd: string; count: number; farePerPerson: number; subtotal: number }[] = [];
  const snapshots: WaterfallSnapshot[] = [];

  // Take initial snapshot
  snapshots.push(takeSnapshot("Initial", sorted, authRemaining, physRemaining));

  for (const cls of sorted) {
    const count = allocations[cls.rbd] || 0;
    if (count <= 0) continue;

    const avail = Math.min(authRemaining[cls.rbd], physRemaining);
    if (count > avail) {
      return {
        feasible: false,
        failureReason: `Cannot fit ${count} in ${cls.rbd}: only ${avail} available`,
        allocations: resultAllocations,
        totalCost: 0,
        groupCost,
        savings: 0,
        savingsPercent: 0,
        snapshots,
      };
    }

    resultAllocations.push({
      rbd: cls.rbd,
      count,
      farePerPerson: cls.farePerPerson,
      subtotal: count * cls.farePerPerson,
    });

    physRemaining -= count;
    for (const c of sorted.filter((c) => c.farePerPerson >= cls.farePerPerson)) {
      authRemaining[c.rbd] -= count;
    }

    snapshots.push(takeSnapshot(`Book ${count} in ${cls.rbd}`, sorted, authRemaining, physRemaining));
  }

  const totalAllocated = Object.values(allocations).reduce((s, n) => s + n, 0);
  const totalCost = resultAllocations.reduce((s, a) => s + a.subtotal, 0);
  const savings = groupCost - totalCost;

  return {
    feasible: totalAllocated === totalPassengers,
    failureReason: totalAllocated !== totalPassengers
      ? `Allocated ${totalAllocated} of ${totalPassengers}`
      : undefined,
    allocations: resultAllocations,
    totalCost,
    groupCost,
    savings,
    savingsPercent: groupCost > 0 ? Math.round((savings / groupCost) * 1000) / 10 : 0,
    snapshots,
  };
}

function takeSnapshot(
  label: string,
  classes: Omit<FareClassInfo, "cabin">[],
  authRemaining: Record<string, number>,
  physRemaining: number,
): WaterfallSnapshot {
  return {
    label,
    physicalRemaining: physRemaining,
    classes: classes.map((c) => {
      const auth = authRemaining[c.rbd];
      const effective = Math.min(Math.max(auth, 0), Math.max(physRemaining, 0));
      return {
        rbd: c.rbd,
        authRemaining: auth,
        physicalRemaining: physRemaining,
        effectiveAvailable: effective,
        fare: c.farePerPerson,
        bindingConstraint: (auth < physRemaining ? "cap" : auth > physRemaining ? "physical" : "both") as ClassSnapshot["bindingConstraint"],
      };
    }),
  };
}

export default function SplitConfigurator({ waterfall, fareClasses, totalPassengers, groupCost }: Props) {
  // Initialize allocations from recommended waterfall
  const initialAllocs: Record<string, number> = {};
  waterfall.allocations.forEach((a) => (initialAllocs[a.rbd] = a.count));

  const [allocations, setAllocations] = useState<Record<string, number>>(initialAllocs);

  const physicalSeats = waterfall.snapshots[0]?.physicalRemaining ?? 30;

  const result = useMemo(
    () => recalcWaterfall(fareClasses, allocations, physicalSeats, groupCost, totalPassengers),
    [fareClasses, allocations, physicalSeats, groupCost, totalPassengers],
  );

  const totalAllocated = Object.values(allocations).reduce((s, n) => s + n, 0);

  const handleSlider = useCallback((rbd: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [rbd]: value }));
  }, []);

  const resetToRecommended = useCallback(() => {
    const reset: Record<string, number> = {};
    waterfall.allocations.forEach((a) => (reset[a.rbd] = a.count));
    setAllocations(reset);
  }, [waterfall]);

  // Get max available per class (from initial snapshot)
  const initialSnapshot = waterfall.snapshots[0];

  return (
    <div className="space-y-5">
      <div className="text-xs text-gray-500">
        Adjust passenger allocation across fare classes. The waterfall recalculates in real-time as you move sliders.
      </div>

      {/* Allocation sliders */}
      <div className="space-y-3">
        {fareClasses
          .sort((a, b) => a.farePerPerson - b.farePerPerson)
          .map((cls) => {
            const count = allocations[cls.rbd] || 0;
            const initAvail = initialSnapshot?.classes.find((c) => c.rbd === cls.rbd)?.effectiveAvailable ?? cls.authCap;
            const maxSlider = Math.min(initAvail, totalPassengers);

            return (
              <div key={cls.rbd} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="font-bold text-sm text-gray-900">{cls.rbd}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatCurrency(cls.farePerPerson, "USD")}/pax
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{count} pax</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {formatCurrency(count * cls.farePerPerson, "USD")}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxSlider}
                  value={count}
                  onChange={(e) => handleSlider(cls.rbd, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>0</span>
                  <span>Max: {initAvail} ({initialSnapshot?.classes.find((c) => c.rbd === cls.rbd)?.bindingConstraint ?? "—"})</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Summary */}
      <div className={`rounded-lg border-2 p-4 ${
        totalAllocated === totalPassengers && result.feasible
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-600">
              Passengers allocated: {totalAllocated}/{totalPassengers}
              {totalAllocated === totalPassengers ? " ✓" : " ✗"}
            </div>
            {result.failureReason && (
              <div className="text-[10px] text-red-600 mt-0.5">{result.failureReason}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(result.totalCost, "USD")}
            </div>
            <div className="text-xs text-gray-500">
              vs. group: {formatCurrency(groupCost, "USD")}
            </div>
            {result.savings > 0 && (
              <div className="text-xs font-semibold text-emerald-600">
                Savings: {formatCurrency(result.savings, "USD")} ({result.savingsPercent}%)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Waterfall note */}
      <div className="text-[10px] text-gray-400 bg-gray-50 rounded-lg p-3">
        When you move passengers between classes, the waterfall recalculates all availability.
        Moving pax OUT of a cheap class may increase availability in expensive classes, and
        moving pax INTO a cheap class reduces availability everywhere (physical seats consumed).
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <button
          onClick={resetToRecommended}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Reset to Recommended
        </button>
      </div>
    </div>
  );
}
