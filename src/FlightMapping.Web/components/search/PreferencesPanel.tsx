"use client";
import { SearchPreferences, SearchPriority } from "@/lib/types";

interface Props {
  preferences: SearchPreferences;
  onChange: (updates: Partial<SearchPreferences>) => void;
}

export default function PreferencesPanel({ preferences, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
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
