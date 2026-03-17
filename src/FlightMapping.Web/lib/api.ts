import { SearchRequest, SearchResponse, SplitPnrAnalysis, WaterfallResult, WaterfallInput, PriceBreakpoint, CabinClass } from "./types";

export async function searchFlights(request: SearchRequest): Promise<SearchResponse> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Search failed (${res.status})`);
  }

  return res.json();
}

export async function parseWithAI(text: string): Promise<Partial<SearchRequest>> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Parse failed (${res.status})`);
  }

  return res.json();
}

export async function analyzeSplitPnr(request: {
  flightKey: string;
  carrier: string;
  route: string;
  cabin: CabinClass;
  totalPassengers: number;
  estimatedPhysicalSeats: number;
  breakpoints: PriceBreakpoint[];
}): Promise<SplitPnrAnalysis> {
  const res = await fetch("/api/split-pnr/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Split PNR analysis failed (${res.status})`);
  }

  return res.json();
}

export async function calculateCustomWaterfall(
  input: WaterfallInput,
  allocations: { rbd: string; count: number }[],
): Promise<WaterfallResult> {
  const res = await fetch("/api/split-pnr/calculate-custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, allocations }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Custom waterfall failed (${res.status})`);
  }

  return res.json();
}
