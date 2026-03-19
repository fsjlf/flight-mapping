import { EnrichedItinerary, SegmentInput, HybridPackageBreakdown } from "./types";

export interface LinkedLegGroup {
  coveredLegIndices: number[];
  label: string;
  itineraries: EnrichedItinerary[];
}

export interface GroupedResults {
  singleTickets: EnrichedItinerary[];
  separateByLeg: EnrichedItinerary[][];
  linkedLegGroups: LinkedLegGroup[];
  cheapestSingleTicketPerAdult: number | null;
  cheapestMixMatchPerAdult: number | null;
  cheapestHybridPackagePerAdult: number | null;
  cheapestHybridBreakdown: HybridPackageBreakdown | null;
  showTabs: boolean;
}

export function groupItineraries(
  itineraries: EnrichedItinerary[],
  searchSegments: SegmentInput[]
): GroupedResults {
  const totalLegs = searchSegments.length;
  const singleTickets: EnrichedItinerary[] = [];
  const oneWays: EnrichedItinerary[] = [];
  const partialLinked: EnrichedItinerary[] = [];

  for (const itin of itineraries) {
    const covered = itin.coveredSegmentIndices;

    // Fallback when coveredSegmentIndices is missing (old data)
    if (!covered || covered.length === 0) {
      if (itin.strategyType === "SeparateOneWays") {
        oneWays.push(itin);
      } else {
        singleTickets.push(itin);
      }
      continue;
    }

    if (covered.length >= totalLegs) {
      singleTickets.push(itin);
    } else if (covered.length === 1) {
      oneWays.push(itin);
    } else {
      partialLinked.push(itin);
    }
  }

  // Place one-ways into leg columns using coveredSegmentIndices[0]
  const separateByLeg: EnrichedItinerary[][] = searchSegments.map(() => []);
  for (const itin of oneWays) {
    const legIdx = itin.coveredSegmentIndices?.[0];
    if (legIdx !== undefined && legIdx >= 0 && legIdx < totalLegs) {
      separateByLeg[legIdx].push(itin);
    } else {
      // Fallback: match by origin/destination
      const seg = itin.segments[0];
      if (!seg) continue;
      const idx = searchSegments.findIndex(
        (s) =>
          (s.origins[0] || "").toUpperCase() === seg.origin.toUpperCase() &&
          (s.destinations[0] || "").toUpperCase() === seg.destination.toUpperCase()
      );
      if (idx >= 0) separateByLeg[idx].push(itin);
    }
  }

  // Build linked leg groups by covered-indices pattern
  const linkedMap = new Map<string, LinkedLegGroup>();
  for (const itin of partialLinked) {
    const sorted = [...itin.coveredSegmentIndices].sort((a, b) => a - b);
    const key = sorted.join(",");
    if (!linkedMap.has(key)) {
      const label = sorted
        .map((i) => `${searchSegments[i]?.origins[0] || ""}\u2192${searchSegments[i]?.destinations[0] || ""}`)
        .join(" + ");
      linkedMap.set(key, { coveredLegIndices: sorted, label, itineraries: [] });
    }
    linkedMap.get(key)!.itineraries.push(itin);
  }
  const linkedLegGroups = Array.from(linkedMap.values());

  // Sort each bucket
  singleTickets.sort((a, b) => a.rank - b.rank);
  for (const leg of separateByLeg) {
    leg.sort((a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult);
  }
  for (const group of linkedLegGroups) {
    group.itineraries.sort((a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult);
  }

  // Cheapest single ticket
  const cheapestSingleTicketPerAdult =
    singleTickets.length > 0
      ? Math.min(...singleTickets.map((i) => i.pricing.pricePerAdult))
      : null;

  // Cheapest pure mix & match (all legs individually)
  const allLegsHaveOptions = separateByLeg.every((leg) => leg.length > 0);
  const cheapestMixMatchPerAdult =
    allLegsHaveOptions && separateByLeg.length > 0
      ? separateByLeg.reduce((sum, leg) => sum + leg[0].pricing.pricePerAdult, 0)
      : null;

  // Cheapest hybrid package (linked group + OWs for uncovered legs)
  let cheapestHybridPackagePerAdult: number | null = null;
  let cheapestHybridBreakdown: HybridPackageBreakdown | null = null;
  for (const group of linkedLegGroups) {
    if (group.itineraries.length === 0) continue;
    const packagePrice = group.itineraries[0].pricing.pricePerAdult;
    const uncovered = searchSegments
      .map((_, i) => i)
      .filter((i) => !group.coveredLegIndices.includes(i));
    const allUncoveredHaveOptions = uncovered.every(
      (i) => separateByLeg[i] && separateByLeg[i].length > 0
    );
    if (allUncoveredHaveOptions) {
      const owLegs = uncovered.map((i) => ({
        label: `${searchSegments[i].origins[0] || ""}\u2192${searchSegments[i].destinations[0] || ""}`,
        pricePerAdult: separateByLeg[i][0].pricing.pricePerAdult,
      }));
      const uncoveredPrice = owLegs.reduce((sum, l) => sum + l.pricePerAdult, 0);
      const total = packagePrice + uncoveredPrice;
      if (cheapestHybridPackagePerAdult === null || total < cheapestHybridPackagePerAdult) {
        cheapestHybridPackagePerAdult = total;
        cheapestHybridBreakdown = {
          totalPerAdult: total,
          packagePerAdult: packagePrice,
          packageLabel: group.label,
          owLegs,
        };
      }
    }
  }

  const showTabs = searchSegments.length > 1;

  return {
    singleTickets,
    separateByLeg,
    linkedLegGroups,
    cheapestSingleTicketPerAdult,
    cheapestMixMatchPerAdult,
    cheapestHybridPackagePerAdult,
    cheapestHybridBreakdown,
    showTabs,
  };
}
