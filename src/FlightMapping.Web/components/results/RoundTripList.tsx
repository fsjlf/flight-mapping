import { EnrichedItinerary, SplitPnrDetection } from "@/lib/types";
import { groupByFlight } from "@/lib/itineraryGrouping2";
import ItineraryCard from "./ItineraryCard";

interface Props {
  itineraries: EnrichedItinerary[];
  /** Min achievable stops per segment position across all itineraries. */
  minStopsPerSeg?: number[];
  /** Split PNR detections keyed by group.flightKey from groupByFlight(). */
  splitPnrDetections?: SplitPnrDetection[];
}

export default function RoundTripList({ itineraries, minStopsPerSeg, splitPnrDetections }: Props) {
  if (itineraries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-700 font-medium">No flights match your filters</p>
        <p className="text-gray-500 text-sm mt-1">
          Try relaxing your filters to see more options.
        </p>
      </div>
    );
  }

  const groups = groupByFlight(itineraries);

  // Build detection lookup by flightKey (same key format as groupByFlight)
  const detectionMap = new Map<string, SplitPnrDetection>();
  if (splitPnrDetections) {
    for (const det of splitPnrDetections) {
      detectionMap.set(det.flightKey, det);
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <ItineraryCard
          key={group.flightKey}
          itinerary={group.primary}
          variants={group.variants}
          minStopsPerSeg={minStopsPerSeg}
          splitPnrDetection={detectionMap.get(group.flightKey)}
        />
      ))}
    </div>
  );
}
