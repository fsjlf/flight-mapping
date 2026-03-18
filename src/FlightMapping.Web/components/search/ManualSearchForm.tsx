"use client";
import { CabinClass, SegmentInput, PassengerConfig, SearchPreferences } from "@/lib/types";
import SegmentRow from "./SegmentRow";
import PassengerSelector from "./PassengerSelector";
import PreferencesPanel from "./PreferencesPanel";

const CABIN_OPTIONS: { value: CabinClass; short: string; label: string }[] = [
  { value: "Economy", short: "Econ", label: "Economy" },
  { value: "PremiumEconomy", short: "Prem", label: "Premium Economy" },
  { value: "Business", short: "Biz", label: "Business" },
  { value: "First", short: "First", label: "First" },
];

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

        {/* Global cabin selector — applies to all segments at once */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-500">Class:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {CABIN_OPTIONS.map(({ value, short, label }) => {
              const globalCabin = preferences.cabin || "Economy";
              const active = globalCabin === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onPreferencesChange({ cabin: value });
                    // Clear all per-segment overrides so they inherit the new global
                    segments.forEach((_, i) => {
                      onSegmentChange(i, { cabinOverride: undefined });
                    });
                  }}
                  className={`px-3 py-1.5 text-xs transition-all cursor-pointer border-none ${
                    active
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                  title={label}
                >
                  {short}
                </button>
              );
            })}
          </div>
          {segments.some((s) => s.cabinOverride) && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Per-segment overrides active
            </span>
          )}
        </div>

        <div className="space-y-2">
          {segments.map((seg, i) => (
            <SegmentRow
              key={i}
              segment={seg}
              index={i}
              canRemove={segments.length > 1}
              globalCabin={preferences.cabin || "Economy"}
              autoFocusDestination={i > 0 && seg.origins.length > 0 && seg.destinations.length === 0}
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
