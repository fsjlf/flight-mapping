"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { decodeSearchParams } from "@/lib/searchStore";
import { searchFlights } from "@/lib/api";
import type { SearchResponse, SearchRequest } from "@/lib/types";
import ComparisonBuilder from "@/components/results/ComparisonBuilder";

type Status = "loading" | "found" | "error" | "invalid";

export default function SearchPage() {
  const params = useParams<{ searchSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) {
      setStatus("invalid");
      return;
    }

    const decoded = decodeSearchParams(q);
    if (!decoded) {
      setStatus("invalid");
      return;
    }

    setRequest(decoded);

    // Fire the search
    let cancelled = false;
    searchFlights(decoded).then((data) => {
      if (cancelled) return;
      setResponse(data);
      setStatus("found");
    }).catch((err) => {
      if (cancelled) return;
      setErrorMsg(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    });

    return () => { cancelled = true; };
  }, [searchParams]);

  if (status === "loading") {
    return <SearchPageSkeleton slug={params.searchSlug} />;
  }

  if (status === "found" && response && request) {
    const q = searchParams.get("q") || "";
    const backUrl = q ? `/?q=${q}` : "/";
    return (
      <ComparisonBuilder
        response={response}
        searchSegments={request.segments}
        passengers={request.passengers}
        onBack={() => router.push(backUrl)}
        onNewSearch={() => router.push(backUrl)}
      />
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-lg w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Search Failed</h1>
          <p className="text-gray-600 mb-2">{errorMsg}</p>
          <SlugSummary slug={params.searchSlug} />
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => {
                setStatus("loading");
                setErrorMsg("");
                const q = searchParams.get("q");
                if (q) {
                  const decoded = decodeSearchParams(q);
                  if (decoded) {
                    searchFlights(decoded).then((data) => {
                      setResponse(data);
                      setStatus("found");
                    }).catch((err) => {
                      setErrorMsg(err instanceof Error ? err.message : "Search failed");
                      setStatus("error");
                    });
                  }
                }
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              New Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Invalid — no ?q= param or couldn't decode
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-lg w-full text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Search URL</h1>
        <p className="text-gray-600 mb-2">
          This URL is missing search parameters.
        </p>
        <SlugSummary slug={params.searchSlug} />
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          New Search
        </button>
      </div>
    </div>
  );
}

function SlugSummary({ slug }: { slug: string }) {
  if (!slug) return null;
  return (
    <p className="text-sm text-gray-500 font-mono bg-gray-50 rounded-lg px-4 py-2 mt-3">
      {slug}
    </p>
  );
}

function SearchPageSkeleton({ slug }: { slug: string }) {
  // Parse readable info from slug for display while loading
  const readable = slug.replace(/-/g, " · ").replace(/_/g, " → ").toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-sm text-gray-500">Searching flights...</div>
          <div className="text-sm font-mono text-gray-400">{readable}</div>
        </div>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
