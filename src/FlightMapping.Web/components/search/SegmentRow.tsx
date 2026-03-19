"use client";
import { useState } from "react";
import { CabinClass, DepartureTimeWindow, SegmentInput } from "@/lib/types";
import AirportChipInput from "./AirportChipInput";

interface Props {
  segment: SegmentInput;
  index: number;
  canRemove: boolean;
  globalCabin: CabinClass;
  autoFocusDestination?: boolean;
  onChange: (index: number, updates: Partial<SegmentInput>) => void;
  onRemove: (index: number) => void;
}

const CABIN_OPTIONS: { value: CabinClass; short: string; label: string }[] = [
  { value: "Economy", short: "Econ", label: "Economy" },
  { value: "PremiumEconomy", short: "Prem", label: "Premium Economy" },
  { value: "Business", short: "Biz", label: "Business" },
  { value: "First", short: "First", label: "First" },
];

export default function SegmentRow({
  segment,
  index,
  canRemove,
  globalCabin,
  autoFocusDestination,
  onChange,
  onRemove,
}: Props) {
  const hasTimeOverride = !!segment.timePreference;
  const [showTime, setShowTime] = useState(hasTimeOverride);

  // Effective cabin: per-segment override or global default
  const effectiveCabin = segment.cabinOverride || globalCabin;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 w-4">{index + 1}</span>
        <AirportChipInput
          codes={segment.origins}
          onChange={(codes) => onChange(index, { origins: codes })}
          placeholder="From (e.g. JFK)"
        />
        <span className="text-gray-400">&rarr;</span>
        <AirportChipInput
          codes={segment.destinations}
          onChange={(codes) => onChange(index, { destinations: codes })}
          placeholder="To (e.g. LHR)"
          autoFocus={autoFocusDestination}
        />
        <input
          type="date"
          value={segment.departureDate}
          onChange={(e) => onChange(index, { departureDate: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Inline cabin selector — always visible */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          {CABIN_OPTIONS.map(({ value, short }) => {
            const active = effectiveCabin === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  onChange(index, {
                    cabinOverride: value === globalCabin ? undefined : value,
                  })
                }
                className={`px-2 py-1.5 text-xs transition-all cursor-pointer border-none ${
                  active
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title={CABIN_OPTIONS.find((o) => o.value === value)?.label}
              >
                {short}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowTime(!showTime)}
          className={`p-1.5 rounded-md transition-colors ${
            hasTimeOverride
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          title="Departure time preference"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
        {canRemove && (
          <button
            onClick={() => onRemove(index)}
            className="text-gray-400 hover:text-red-500 text-lg leading-none"
            title="Remove segment"
          >
            &times;
          </button>
        )}
      </div>

      {showTime && (
        <div className="flex items-center gap-3 ml-7 pl-1">
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Departure time</label>
            <select
              value={segment.timePreference || ""}
              onChange={(e) =>
                onChange(index, {
                  timePreference: (e.target.value as DepartureTimeWindow) || undefined,
                })
              }
              className="px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any time</option>
              <option value="Morning">Morning (6am-12pm)</option>
              <option value="Afternoon">Afternoon (12pm-6pm)</option>
              <option value="Evening">Evening (6pm-10pm)</option>
              <option value="RedEye">Red-eye (10pm-6am)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
