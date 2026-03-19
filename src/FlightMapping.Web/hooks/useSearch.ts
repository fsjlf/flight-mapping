"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  SearchRequest,
  SearchResponse,
  SegmentInput,
  PassengerConfig,
  SearchPreferences,
  SearchHistoryEntry,
  normalizeSegment,
} from "@/lib/types";
import { searchFlights } from "@/lib/api";
import { buildHistoryEntry } from "@/lib/exportSearchHistory";
import { buildSearchUrl, decodeSearchParams } from "@/lib/searchStore";

const defaultSegment: SegmentInput = {
  origins: [],
  destinations: [],
  departureDate: "",
};

const defaultPassengers: PassengerConfig = {
  adults: 1,
  children: 0,
  infants: 0,
  infantsWithSeat: 0,
};

export function useSearch() {
  const urlParams = useSearchParams();
  const [segments, setSegments] = useState<SegmentInput[]>([{ ...defaultSegment }]);
  const [passengers, setPassengers] = useState<PassengerConfig>({ ...defaultPassengers });
  const [preferences, setPreferences] = useState<SearchPreferences>({});
  const [restoredFromUrl, setRestoredFromUrl] = useState(false);

  // Restore form state from ?q= URL param (e.g. when navigating back from results)
  useEffect(() => {
    if (restoredFromUrl) return;
    const q = urlParams.get("q");
    if (!q) return;
    const decoded = decodeSearchParams(q);
    if (!decoded) return;
    if (decoded.segments?.length) {
      setSegments(decoded.segments.map((s) => normalizeSegment(s as any)));
    }
    if (decoded.passengers) setPassengers(decoded.passengers);
    if (decoded.preferences) setPreferences(decoded.preferences);
    setRestoredFromUrl(true);
  }, [urlParams, restoredFromUrl]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchUrl, setLastSearchUrl] = useState<string | null>(null);
  const searchHistoryRef = useRef<SearchHistoryEntry[]>([]);

  const addSegment = useCallback(() => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          ...defaultSegment,
          origins: last?.destinations?.length ? [...last.destinations] : [],
          departureDate: last?.departureDate || "",
        },
      ];
    });
  }, []);

  const removeSegment = useCallback((index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSegment = useCallback((index: number, updates: Partial<SegmentInput>) => {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, ...updates } : seg))
    );
  }, []);

  const updatePassengers = useCallback((updates: Partial<PassengerConfig>) => {
    setPassengers((prev) => ({ ...prev, ...updates }));
  }, []);

  const updatePreferences = useCallback((updates: Partial<SearchPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  }, []);

  const applyParsed = useCallback((req: Partial<SearchRequest>) => {
    if (req.segments?.length) {
      // Normalize old "origin"/"destination" format from NLP parser
      setSegments(req.segments.map((s) => normalizeSegment(s as any)));
    }
    if (req.passengers) setPassengers(req.passengers);
    if (req.preferences) setPreferences(req.preferences);
  }, []);

  const search = useCallback(async () => {
    const validSegments = segments.filter(
      (s) => s.origins.length > 0 && s.destinations.length > 0 && s.departureDate
    );
    if (validSegments.length === 0) {
      setError("Add at least one segment with origin, destination, and date");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setLastSearchUrl(null);

    try {
      const request: SearchRequest = {
        segments: validSegments,
        passengers,
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
      };
      const data = await searchFlights(request);
      setResponse(data);

      // Generate bookmarkable URL from search params (no storage needed)
      const url = buildSearchUrl(
        validSegments,
        passengers,
        Object.keys(preferences).length > 0 ? preferences : undefined,
      );
      setLastSearchUrl(url);

      // Accumulate search history for export
      const entry = buildHistoryEntry(
        {
          segments: validSegments,
          passengers,
          preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
        },
        data
      );
      searchHistoryRef.current = [...searchHistoryRef.current, entry];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [segments, passengers, preferences]);

  const isValid = segments.some((s) => s.origins.length > 0 && s.destinations.length > 0 && s.departureDate);

  return {
    segments,
    passengers,
    preferences,
    response,
    loading,
    error,
    isValid,
    lastSearchUrl,
    addSegment,
    removeSegment,
    updateSegment,
    updatePassengers,
    updatePreferences,
    applyParsed,
    search,
    searchHistory: searchHistoryRef.current,
  };
}
