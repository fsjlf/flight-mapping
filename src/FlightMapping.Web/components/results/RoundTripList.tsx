import { EnrichedItinerary } from "@/lib/types";
import { groupByFlight } from "@/lib/itineraryGrouping2";
import ItineraryCard from "./ItineraryCard";

interface Props {
  itineraries: EnrichedItinerary[];
}

export default function RoundTripList({ itineraries }: Props) {
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

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <ItineraryCard
          key={group.flightKey}
          itinerary={group.primary}
          variants={group.variants}
        />
      ))}
    </div>
  );
}
