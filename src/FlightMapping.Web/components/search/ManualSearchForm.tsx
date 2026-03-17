"use client";
import { SegmentInput, PassengerConfig, SearchPreferences } from "@/lib/types";
import SegmentRow from "./SegmentRow";
import PassengerSelector from "./PassengerSelector";
import PreferencesPanel from "./PreferencesPanel";

interface Props {
  segments: SegmentInput[];
  passengers: PassengerConfig;
  preferences: SearchPreferences;
  onSegmentChange: (index: number, updates: Partial<SegmentInput>) => void;
  onAddSegment: () => void;
  onRemoveSegment: (index: number) => void;
  onPassengersChange: (updates: Partial<PassengerConfig>) => void;
  onPreferencesChange: (updates: Partial<SearchPreferences>) => void;
  onSearch: () => void;
  loading: boolean;
  isValid: boolean;
}

export default function ManualSearchForm({
  segments,
  passengers,
  preferences,
  onSegmentChange,
  onAddSegment,
  onRemoveSegment,
  onPassengersChange,
  onPreferencesChange,
  onSearch,
  loading,
  isValid,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Segments</label>
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <SegmentRow
              key={i}
              segment={seg}
              index={i}
              canRemove={segments.length > 1}
              globalCabin={preferences.cabins?.[0] || preferences.cabin || "Economy"}
              autoFocusDestination={i > 0 && !!seg.origin && !seg.destination}
              onChange={onSegmentChange}
              onRemove={onRemoveSegment}
            />
          ))}
        </div>
        <button
          onClick={onAddSegment}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          + Add segment
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Passengers</label>
        <PassengerSelector passengers={passengers} onChange={onPassengersChange} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferences</label>
        <PreferencesPanel preferences={preferences} onChange={onPreferencesChange} />
      </div>

      <button
        onClick={onSearch}
        disabled={!isValid || loading}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Searching..." : "Search Flights"}
      </button>
    </div>
  );
}
