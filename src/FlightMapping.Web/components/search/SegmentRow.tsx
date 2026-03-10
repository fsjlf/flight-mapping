"use client";
import { useState } from "react";
import { CabinClass, DepartureTimeWindow, SegmentInput } from "@/lib/types";

interface Props {
  segment: SegmentInput;
  index: number;
  canRemove: boolean;
  globalCabin: CabinClass;
  onChange: (index: number, updates: Partial<SegmentInput>) => void;
  onRemove: (index: number) => void;
}

export default function SegmentRow({
  segment,
  index,
  canRemove,
  globalCabin,
  onChange,
  onRemove,
}: Props) {
  const hasOverrides = !!segment.cabinOverride || !!segment.timePreference;
  const [expanded, setExpanded] = useState(hasOverrides);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 w-4">{index + 1}</span>
        <input
          type="text"
          placeholder="From (e.g. JFK)"
          value={segment.origin}
          onChange={(e) => onChange(index, { origin: e.target.value.toUpperCase() })}
          maxLength={3}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
        />
        <span className="text-gray-400">&rarr;</span>
        <input
          type="text"
          placeholder="To (e.g. LHR)"
          value={segment.destination}
          onChange={(e) =>
            onChange(index, { destination: e.target.value.toUpperCase() })
          }
          maxLength={3}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
        />
        <input
          type="date"
          value={segment.departureDate}
          onChange={(e) => onChange(index, { departureDate: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className={`p-1.5 rounded-md transition-colors ${
            hasOverrides
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          title="Per-segment options"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
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

      {expanded && (
        <div className="flex items-center gap-3 ml-7 pl-1">
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Cabin</label>
            <select
              value={segment.cabinOverride || ""}
              onChange={(e) =>
                onChange(index, {
                  cabinOverride: (e.target.value as CabinClass) || undefined,
                })
              }
              className="px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default ({globalCabin})</option>
              <option value="Economy">Economy</option>
              <option value="PremiumEconomy">Premium Economy</option>
              <option value="Business">Business</option>
              <option value="First">First</option>
            </select>
          </div>
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
