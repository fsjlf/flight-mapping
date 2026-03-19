"use client";

import { useState, useRef, useEffect } from "react";
import {
  FilterState,
  StopsFilter,
  SortOption,
  TimeWindow,
  isFilterActive,
} from "@/lib/filterTypes";
import { SegmentInput } from "@/lib/types";

interface AirlineOption {
  code: string;
  count: number;
}

interface Props {
  filters: FilterState;
  onChange: (update: Partial<FilterState>) => void;
  onReset: () => void;
  airlines: AirlineOption[];
  priceRange: { min: number; max: number };
  durationRange: { min: number; max: number };
  filteredCount: number;
  totalCount: number;
  searchSegments: SegmentInput[];
}

export default function FilterBar({
  filters,
  onChange,
  onReset,
  airlines,
  priceRange,
  durationRange,
  filteredCount,
  totalCount,
  searchSegments,
}: Props) {
  const hasActiveFilter = isFilterActive(filters);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white border border-gray-200 rounded-lg">
      {/* Stops toggle */}
      <StopsToggle value={filters.stops} onChange={(stops) => onChange({ stops })} />

      <Divider />

      {/* Sort */}
      <SortDropdown value={filters.sortBy} onChange={(sortBy) => onChange({ sortBy })} />

      <Divider />

      {/* Airlines */}
      <AirlineFilter
        airlines={airlines}
        selected={filters.airlines}
        onChange={(a) => onChange({ airlines: a })}
      />

      {/* More filters */}
      <MoreFilters
        filters={filters}
        onChange={onChange}
        priceRange={priceRange}
        durationRange={durationRange}
        searchSegments={searchSegments}
      />

      {/* Reset */}
      {hasActiveFilter && (
        <button
          onClick={onReset}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Reset
        </button>
      )}

      {/* Count */}
      <div className="ml-auto text-xs text-gray-500">
        {hasActiveFilter ? (
          <span>
            <span className="font-semibold text-gray-700">{filteredCount}</span>{" "}
            of {totalCount}
          </span>
        ) : (
          <span>{totalCount} results</span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200" />;
}

/* ─── Stops Toggle ─── */

const STOPS_OPTIONS: { value: StopsFilter; label: string }[] = [
  { value: "nonstop", label: "Nonstop" },
  { value: "up-to-1", label: "≤1 Stop" },
  { value: "any", label: "Any" },
];

function StopsToggle({
  value,
  onChange,
}: {
  value: StopsFilter;
  onChange: (v: StopsFilter) => void;
}) {
  return (
    <div className="flex bg-gray-100 rounded-md p-0.5">
      {STOPS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Sort Dropdown ─── */

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "cheapest", label: "Cheapest" },
  { value: "fastest", label: "Fastest" },
  { value: "fewest-stops", label: "Fewest Stops" },
];

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">Sort:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="text-xs font-medium bg-transparent border-none cursor-pointer text-gray-700 focus:outline-none"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Airline Filter ─── */

function AirlineFilter({
  airlines,
  selected,
  onChange,
}: {
  airlines: AirlineOption[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  const label =
    selected.size === 0
      ? "Airlines"
      : selected.size === 1
      ? [...selected][0]
      : `${selected.size} airlines`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
          selected.size > 0
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 text-gray-600 hover:border-gray-300"
        }`}
      >
        {label} ▾
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56 max-h-64 overflow-y-auto">
          <div className="flex gap-2 px-3 py-2 border-b border-gray-100 text-xs">
            <button
              onClick={() => onChange(new Set())}
              className="text-blue-600 hover:text-blue-800"
            >
              All
            </button>
            <button
              onClick={() => onChange(new Set(airlines.map((a) => a.code)))}
              className="text-blue-600 hover:text-blue-800"
            >
              None
            </button>
          </div>
          {airlines.map((a) => {
            const checked = selected.size === 0 || selected.has(a.code);
            return (
              <label
                key={a.code}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(a.code)}
                  className="rounded text-blue-600"
                />
                <span className="font-medium">{a.code}</span>
                <span className="text-gray-400 ml-auto">({a.count})</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── More Filters ─── */

const TIME_WINDOWS: { value: TimeWindow; label: string; hours: string }[] = [
  { value: "morning", label: "Morning", hours: "6a–12p" },
  { value: "afternoon", label: "Afternoon", hours: "12p–6p" },
  { value: "evening", label: "Evening", hours: "6p–10p" },
  { value: "redeye", label: "Red-eye", hours: "10p–6a" },
];

function MoreFilters({
  filters,
  onChange,
  priceRange,
  durationRange,
  searchSegments,
}: {
  filters: FilterState;
  onChange: (update: Partial<FilterState>) => void;
  priceRange: { min: number; max: number };
  durationRange: { min: number; max: number };
  searchSegments: SegmentInput[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const moreActive =
    filters.maxPrice !== null ||
    filters.maxDurationMinutes !== null ||
    filters.departureTimeWindows.size > 0;

  const toggleTimeWindow = (segIdx: number, tw: TimeWindow) => {
    const next = new Map(filters.departureTimeWindows);
    const current = new Set(next.get(segIdx) ?? []);
    if (current.has(tw)) current.delete(tw);
    else current.add(tw);
    if (current.size === 0) next.delete(segIdx);
    else next.set(segIdx, current);
    onChange({ departureTimeWindows: next });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
          moreActive
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 text-gray-600 hover:border-gray-300"
        }`}
      >
        More ▾
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80 p-4 space-y-4">
          {/* Max price */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max price per person
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">$</span>
              <input
                type="number"
                value={filters.maxPrice ?? ""}
                onChange={(e) =>
                  onChange({
                    maxPrice: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder={`${Math.ceil(priceRange.max)}`}
                className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
              />
              <span className="text-xs text-gray-400">
                (min ${Math.floor(priceRange.min)})
              </span>
            </div>
          </div>

          {/* Max duration */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max duration (hours)
            </label>
            <input
              type="number"
              value={
                filters.maxDurationMinutes !== null
                  ? Math.round(filters.maxDurationMinutes / 60)
                  : ""
              }
              onChange={(e) =>
                onChange({
                  maxDurationMinutes: e.target.value
                    ? Number(e.target.value) * 60
                    : null,
                })
              }
              placeholder={`${Math.ceil(durationRange.max / 60)}`}
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
            />
          </div>

          {/* Departure time per segment */}
          {searchSegments.map((seg, idx) => (
            <div key={idx}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {searchSegments.length > 1
                  ? `${seg.origins[0] || ""} → ${seg.destinations[0] || ""} departure`
                  : "Departure time"}
              </label>
              <div className="flex flex-wrap gap-1">
                {TIME_WINDOWS.map((tw) => {
                  const active =
                    filters.departureTimeWindows.get(idx)?.has(tw.value) ?? false;
                  return (
                    <button
                      key={tw.value}
                      onClick={() => toggleTimeWindow(idx, tw.value)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        active
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {tw.label}
                      <span className="text-[10px] ml-0.5 opacity-60">
                        {tw.hours}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
