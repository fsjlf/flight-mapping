"use client";
import { CabinClass, SearchPreferences, SearchPriority } from "@/lib/types";

interface Props {
  preferences: SearchPreferences;
  onChange: (updates: Partial<SearchPreferences>) => void;
}

export default function PreferencesPanel({ preferences, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cabin</label>
        <select
          value={preferences.cabin || "Economy"}
          onChange={(e) => onChange({ cabin: e.target.value as CabinClass })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="Economy">Economy</option>
          <option value="PremiumEconomy">Premium Economy</option>
          <option value="Business">Business</option>
          <option value="First">First</option>
        </select>
        <span className="block text-xs text-gray-400 mt-0.5">Default for all segments</span>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Priority</label>
        <select
          value={preferences.priority || "Balanced"}
          onChange={(e) => onChange({ priority: e.target.value as SearchPriority })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="Balanced">Balanced</option>
          <option value="Price">Cheapest</option>
          <option value="Duration">Fastest</option>
          <option value="Comfort">Most Comfortable</option>
        </select>
      </div>
    </div>
  );
}
