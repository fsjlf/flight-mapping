"use client";
import { useState, useEffect, useRef } from "react";
import { SearchRequest } from "@/lib/types";
import { useSearch } from "@/hooks/useSearch";
import { downloadSearchHistoryJson } from "@/lib/exportSearchHistory";
import ManualSearchForm from "./ManualSearchForm";
import NaturalLanguageInput from "./NaturalLanguageInput";
import ResultsContainer from "../results/ResultsContainer";
import ComparisonBuilder from "../results/ComparisonBuilder";
import LoadingSpinner from "../ui/LoadingSpinner";

type Tab = "manual" | "paste";
type View = "search" | "builder" | "simple-results";

export default function SearchContainer() {
  const [tab, setTab] = useState<Tab>("paste");
  const [view, setView] = useState<View>("search");
  const search = useSearch();
  const prevResponseRef = useRef(search.response);

  const handleParsed = (req: Partial<SearchRequest>) => {
    search.applyParsed(req);
    setTab("manual");
  };

  const handleExportHistory = () => {
    downloadSearchHistoryJson(search.searchHistory);
  };

  // Auto-navigate to builder when new results arrive
  useEffect(() => {
    if (search.response && search.response !== prevResponseRef.current) {
      prevResponseRef.current = search.response;
      setView("builder");
    }
  }, [search.response]);

  // Loading state (show spinner over the search form)
  if (search.loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // Full-screen comparison builder
  if (view === "builder" && search.response) {
    return (
      <ComparisonBuilder
        response={search.response}
        searchSegments={search.segments}
        passengers={search.passengers}
        onBack={() => setView("simple-results")}
        onNewSearch={() => setView("search")}
      />
    );
  }

  // Simple results view (legacy — accessible via "← Results" from builder)
  if (view === "simple-results" && search.response) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView("search")}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            ← New Search
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Results</h1>
        </div>
        <ResultsContainer
          response={search.response}
          loading={search.loading}
          error={search.error}
          searchSegments={search.segments}
          onExportHistory={handleExportHistory}
          searchHistoryCount={search.searchHistory.length}
          onOpenBuilder={() => setView("builder")}
          totalPassengers={search.passengers.adults + search.passengers.children + search.passengers.infantsWithSeat}
        />
      </div>
    );
  }

  // Error from search
  if (search.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Flight Search</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
          <p className="text-red-700 font-medium">Search failed</p>
          <p className="text-red-600 text-sm mt-1">{search.error}</p>
        </div>
        <SearchForm
          tab={tab}
          setTab={setTab}
          search={search}
          onParsed={handleParsed}
        />
      </div>
    );
  }

  // Default: search form
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Flight Search</h1>
      <SearchForm
        tab={tab}
        setTab={setTab}
        search={search}
        onParsed={handleParsed}
      />
    </div>
  );
}

// Extracted search form to avoid duplication
function SearchForm({
  tab,
  setTab,
  search,
  onParsed,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  search: ReturnType<typeof import("@/hooks/useSearch").useSearch>;
  onParsed: (req: Partial<SearchRequest>) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
      {tab === "paste" && <NaturalLanguageInput onParsed={onParsed} />}

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
  );
}
