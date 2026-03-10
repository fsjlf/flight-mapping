"use client";
import { useState } from "react";
import { SearchRequest } from "@/lib/types";
import { useSearch } from "@/hooks/useSearch";
import ManualSearchForm from "./ManualSearchForm";
import NaturalLanguageInput from "./NaturalLanguageInput";
import ResultsContainer from "../results/ResultsContainer";

type Tab = "manual" | "paste";

export default function SearchContainer() {
  const [tab, setTab] = useState<Tab>("paste");
  const search = useSearch();

  const handleParsed = (req: Partial<SearchRequest>) => {
    search.applyParsed(req);
    setTab("manual");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Flight Search</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("paste")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "paste"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Paste Itinerary
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "manual"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Build Search
          </button>
        </div>

        {/* Tab content */}
        {tab === "paste" && <NaturalLanguageInput onParsed={handleParsed} />}

        {tab === "manual" && (
          <ManualSearchForm
            segments={search.segments}
            passengers={search.passengers}
            preferences={search.preferences}
            onSegmentChange={search.updateSegment}
            onAddSegment={search.addSegment}
            onRemoveSegment={search.removeSegment}
            onPassengersChange={search.updatePassengers}
            onPreferencesChange={search.updatePreferences}
            onSearch={search.search}
            loading={search.loading}
            isValid={search.isValid}
          />
        )}
      </div>

      {/* Results */}
      <ResultsContainer
        response={search.response}
        loading={search.loading}
        error={search.error}
        searchSegments={search.segments}
      />
    </div>
  );
}
