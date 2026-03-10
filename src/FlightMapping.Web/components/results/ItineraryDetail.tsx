import { EnrichedItinerary } from "@/lib/types";
import SegmentTimeline from "./SegmentTimeline";
import PricingBreakdown from "./PricingBreakdown";
import ScoreBar from "./ScoreBar";
import Badge from "../ui/Badge";

interface Props {
  itinerary: EnrichedItinerary;
}

export default function ItineraryDetail({ itinerary }: Props) {
  const { segments, pricing, scores, farePolicy, highlights, warnings } =
    itinerary;

  return (
    <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
      {/* Badges */}
      {(highlights.length > 0 || warnings.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {highlights.map((h, i) => (
            <Badge key={`h-${i}`} text={h} variant="highlight" />
          ))}
          {warnings.map((w, i) => (
            <Badge key={`w-${i}`} text={w} variant="warning" />
          ))}
        </div>
      )}

      {/* Segment timelines */}
      <div className="space-y-3">
        {segments.map((seg, i) => (
          <SegmentTimeline key={i} segment={seg} index={i} />
        ))}
      </div>

      {/* Bottom grid: pricing + scores + meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pricing */}
        <PricingBreakdown pricing={pricing} />

        {/* Scores */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-xs font-medium text-gray-500 mb-3">Scores</h4>
          <div className="space-y-2">
            <ScoreBar label="Overall" score={scores.overall} />
            <ScoreBar label="Value" score={scores.valueScore} />
            <ScoreBar label="Schedule" score={scores.scheduleScore} />
            <ScoreBar label="Duration" score={scores.durationScore} />
            <ScoreBar label="Comfort" score={scores.comfortScore} />
            <ScoreBar label="Reliability" score={scores.reliabilityScore} />
          </div>
        </div>

        {/* Metadata */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-xs font-medium text-gray-500 mb-3">Details</h4>
          <dl className="space-y-1.5 text-xs">
            <DetailRow label="Strategy" value={itinerary.strategyDescription} />
            <DetailRow
              label="Validating"
              value={itinerary.validatingCarrier}
            />
            {itinerary.governingCarriers && (
              <DetailRow
                label="Governing"
                value={itinerary.governingCarriers}
              />
            )}
            <DetailRow
              label="Distance"
              value={`${itinerary.totalMilesFlown.toLocaleString()} mi`}
            />
            <DetailRow
              label="Refundable"
              value={farePolicy.nonRefundable ? "No" : "Yes"}
            />
            <DetailRow
              label="e-Ticket"
              value={itinerary.eTicketable ? "Yes" : "No"}
            />
            <DetailRow label="Source" value={itinerary.pricingSource} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}
