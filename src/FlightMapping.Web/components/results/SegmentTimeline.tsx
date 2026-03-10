import { EnrichedSegment } from "@/lib/types";
import { formatTime, formatDate } from "@/lib/formatters";

interface Props {
  segment: EnrichedSegment;
  index: number;
}

export default function SegmentTimeline({ segment, index }: Props) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs font-medium text-gray-500 mb-3">
        Segment {index + 1}: {segment.origin} → {segment.destination}
        <span className="ml-2 text-gray-400">
          {segment.durationFormatted} · {segment.stops === 0 ? "Nonstop" : `${segment.stops} stop${segment.stops > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="space-y-0">
        {segment.legs.map((leg, i) => (
          <div key={i}>
            {/* Connection indicator */}
            {i > 0 && leg.connectionTimeToNextMinutes !== undefined && (
              <div className="flex items-center gap-2 py-2 pl-6">
                <div className="w-px h-4 bg-gray-300" />
                <span className="text-xs text-amber-600">
                  Connection: {formatConnectionTime(segment.legs[i - 1].connectionTimeToNextMinutes)}
                </span>
              </div>
            )}

            {/* Leg row */}
            <div className="flex items-center gap-3 py-2">
              {/* Times */}
              <div className="w-20 text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatTime(leg.departureTime)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(leg.departureTime)}
                </div>
              </div>

              {/* Visual connector */}
              <div className="flex flex-col items-center w-8">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <div className="w-px h-8 bg-gray-300" />
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>

              {/* Flight info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {leg.origin}
                  </span>
                  <span className="text-xs text-gray-400">→</span>
                  <span className="text-sm font-medium text-gray-900">
                    {leg.destination}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {leg.flightNumber}
                  {leg.operatingCarrier !== leg.marketingCarrier && (
                    <span className="text-gray-400">
                      {" "}
                      · Operated by {leg.operatingCarrier}
                    </span>
                  )}
                  {leg.equipment && (
                    <span className="text-gray-400"> · {leg.equipment}</span>
                  )}
                  <span className="text-gray-400">
                    {" "}
                    · {leg.bookingClass}
                  </span>
                  {leg.seatsAvailable > 0 && leg.seatsAvailable <= 4 && (
                    <span className="text-red-500 font-medium">
                      {" "}
                      · {leg.seatsAvailable} left
                    </span>
                  )}
                </div>
              </div>

              {/* Arrival time */}
              <div className="w-20 text-left">
                <div className="text-sm font-medium text-gray-900">
                  {formatTime(leg.arrivalTime)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(leg.arrivalTime)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatConnectionTime(minutes?: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
