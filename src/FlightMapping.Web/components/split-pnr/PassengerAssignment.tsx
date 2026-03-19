"use client";

import { useState, useCallback } from "react";
import { PnrGroup } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  pnrs: PnrGroup[];
  passengerNames?: string[];
}

interface PassengerSlot {
  id: string;
  name: string;
  pnrNumber: number;
}

export default function PassengerAssignment({ pnrs, passengerNames }: Props) {
  const totalPax = pnrs.reduce((s, p) => s + p.passengerCount, 0);

  // Generate passenger slots
  const defaultNames = passengerNames?.length === totalPax
    ? passengerNames
    : Array.from({ length: totalPax }, (_, i) => `Passenger ${i + 1}`);

  // Initialize assignment: fill PNRs in order
  const [passengers, setPassengers] = useState<PassengerSlot[]>(() => {
    const slots: PassengerSlot[] = [];
    let paxIdx = 0;
    for (const pnr of pnrs) {
      for (let j = 0; j < pnr.passengerCount; j++) {
        slots.push({
          id: `pax-${paxIdx}`,
          name: defaultNames[paxIdx] ?? `Passenger ${paxIdx + 1}`,
          pnrNumber: pnr.pnrNumber,
        });
        paxIdx++;
      }
    }
    return slots;
  });

  const [dragId, setDragId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDrop = useCallback(
    (targetPnr: number) => {
      if (!dragId) return;
      setPassengers((prev) => {
        // Check if target PNR has room
        const targetCount = prev.filter((p) => p.pnrNumber === targetPnr && p.id !== dragId).length;
        const pnr = pnrs.find((p) => p.pnrNumber === targetPnr);
        if (!pnr || targetCount >= pnr.passengerCount) return prev;

        return prev.map((p) => (p.id === dragId ? { ...p, pnrNumber: targetPnr } : p));
      });
      setDragId(null);
    },
    [dragId, pnrs],
  );

  const handleNameChange = useCallback((id: string, name: string) => {
    setPassengers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  // Get the cheapest and most flexible PNRs for the tip
  const sortedPnrs = [...pnrs].sort((a, b) => a.farePerPerson - b.farePerPerson);
  const cheapestRbd = sortedPnrs[0]?.rbd;
  const flexibleRbd = sortedPnrs[sortedPnrs.length - 1]?.rbd;

  return (
    <div className="space-y-5">
      {/* Tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <span className="font-semibold">Tip:</span> Put travelers who might cancel in the flexible fare
        classes ({flexibleRbd}), and definite travelers in {cheapestRbd} (cheapest). Drag passengers between PNRs.
      </div>

      {/* PNR groups */}
      <div className="space-y-4">
        {pnrs.map((pnr) => {
          const paxInPnr = passengers.filter((p) => p.pnrNumber === pnr.pnrNumber);
          const isFull = paxInPnr.length >= pnr.passengerCount;

          return (
            <div
              key={pnr.pnrNumber}
              className={`rounded-xl border-2 p-4 transition-colors ${
                dragId && !isFull
                  ? "border-blue-300 bg-blue-50/30"
                  : "border-gray-200"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(pnr.pnrNumber);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-bold text-gray-900">
                    PNR {pnr.pnrNumber}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {pnr.rbd} class @ {formatCurrency(pnr.farePerPerson, "USD")}/ea
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {pnr.rulesSummary ?? (pnr.farePerPerson === sortedPnrs[0]?.farePerPerson ? "non-refundable" : "flexible")}
                </div>
              </div>

              <div className="space-y-1.5">
                {paxInPnr.map((pax) => (
                  <div
                    key={pax.id}
                    draggable
                    onDragStart={() => handleDragStart(pax.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-grab active:cursor-grabbing ${
                      dragId === pax.id
                        ? "border-blue-400 bg-blue-50 shadow-md"
                        : "border-gray-150 bg-white hover:border-gray-300"
                    }`}
                  >
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    <input
                      type="text"
                      value={pax.name}
                      onChange={(e) => handleNameChange(pax.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0"
                    />
                  </div>
                ))}
                {paxInPnr.length < pnr.passengerCount && (
                  <div className="flex items-center justify-center py-3 rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
                    Drop passenger here ({pnr.passengerCount - paxInPnr.length} slot{pnr.passengerCount - paxInPnr.length !== 1 ? "s" : ""} remaining)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
