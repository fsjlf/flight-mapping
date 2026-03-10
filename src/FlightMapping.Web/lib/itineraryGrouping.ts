import { EnrichedItinerary, SegmentInput } from "./types";

export interface GroupedResults {
  singleTickets: EnrichedItinerary[];
  separateByLeg: EnrichedItinerary[][];
  cheapestSingleTicketPerAdult: number | null;
  cheapestMixMatchPerAdult: number | null;
  showTabs: boolean;
}

export function groupItineraries(
  itineraries: EnrichedItinerary[],
  searchSegments: SegmentInput[]
): GroupedResults {
  const singleTickets: EnrichedItinerary[] = [];
  const separateOws: EnrichedItinerary[] = [];

  for (const itin of itineraries) {
    if (itin.strategyType === "SeparateOneWays") {
      separateOws.push(itin);
    } else {
      singleTickets.push(itin);
    }
  }

  // Classify each one-way into a leg index by matching origin/destination
  const separateByLeg: EnrichedItinerary[][] = searchSegments.map(() => []);

  for (const itin of separateOws) {
    const seg = itin.segments[0];
    if (!seg) continue;
    const legIdx = searchSegments.findIndex(
      (s) =>
        s.origin.toUpperCase() === seg.origin.toUpperCase() &&
        s.destination.toUpperCase() === seg.destination.toUpperCase()
    );
    if (legIdx >= 0) {
      separateByLeg[legIdx].push(itin);
    }
  }

  // Sort: single tickets by rank, each leg column by pricePerAdult
  singleTickets.sort((a, b) => a.rank - b.rank);
  for (const leg of separateByLeg) {
    leg.sort((a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult);
  }

  const cheapestSingleTicketPerAdult =
    singleTickets.length > 0
      ? Math.min(...singleTickets.map((i) => i.pricing.pricePerAdult))
      : null;

  const allLegsHaveOptions = separateByLeg.every((leg) => leg.length > 0);
  const cheapestMixMatchPerAdult =
    allLegsHaveOptions && separateByLeg.length > 0
      ? separateByLeg.reduce((sum, leg) => sum + leg[0].pricing.pricePerAdult, 0)
      : null;

  const showTabs =
    searchSegments.length > 1 &&
    singleTickets.length > 0 &&
    separateOws.length > 0;

  return {
    singleTickets,
    separateByLeg,
    cheapestSingleTicketPerAdult,
    cheapestMixMatchPerAdult,
    showTabs,
  };
}
