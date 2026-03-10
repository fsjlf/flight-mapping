namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;

public class TripClassifier : ITripClassifier
{
    public TripClassification Classify(List<SegmentInput> segments)
    {
        if (segments.Count == 1)
        {
            return new TripClassification
            {
                Type = TripType.OneWay,
                SingleTicketPossible = true,
                RecommendedStrategies = [TicketingStrategyType.SingleTicket],
                Reasoning = "Single segment detected as one-way trip"
            };
        }

        if (segments.Count == 2)
            return ClassifyTwoSegments(segments[0], segments[1]);

        return ClassifyMultiSegment(segments);
    }

    private static TripClassification ClassifyTwoSegments(SegmentInput seg1, SegmentInput seg2)
    {
        var originMatch = string.Equals(seg1.Origin, seg2.Destination, StringComparison.OrdinalIgnoreCase);
        var destMatch = string.Equals(seg1.Destination, seg2.Origin, StringComparison.OrdinalIgnoreCase);

        if (originMatch && destMatch)
        {
            return new TripClassification
            {
                Type = TripType.RoundTrip,
                SingleTicketPossible = true,
                RecommendedStrategies =
                [
                    TicketingStrategyType.SingleTicket,
                    TicketingStrategyType.SeparateOneWays
                ],
                Reasoning = $"Two segments {seg1.Origin}→{seg1.Destination}, {seg2.Origin}→{seg2.Destination} detected as round trip"
            };
        }

        if (destMatch && !originMatch)
        {
            return new TripClassification
            {
                Type = TripType.OpenJawOrigin,
                SingleTicketPossible = true,
                RecommendedStrategies =
                [
                    TicketingStrategyType.SingleTicket,
                    TicketingStrategyType.SeparateOneWays,
                    TicketingStrategyType.HybridRtPlusOw
                ],
                Reasoning = $"Return departs from {seg2.Origin} (same as outbound destination) but returns to {seg2.Destination} (different from outbound origin {seg1.Origin})"
            };
        }

        if (originMatch && !destMatch)
        {
            return new TripClassification
            {
                Type = TripType.OpenJawDestination,
                SingleTicketPossible = true,
                RecommendedStrategies =
                [
                    TicketingStrategyType.SingleTicket,
                    TicketingStrategyType.SeparateOneWays,
                    TicketingStrategyType.HybridRtPlusOw
                ],
                Reasoning = $"Return to origin {seg2.Destination} but departs from {seg2.Origin} (different from outbound destination {seg1.Destination})"
            };
        }

        return new TripClassification
        {
            Type = TripType.DoubleOpenJaw,
            SingleTicketPossible = false,
            RecommendedStrategies =
            [
                TicketingStrategyType.SeparateOneWays,
                TicketingStrategyType.HybridRtPlusOw
            ],
            Reasoning = $"No matching origin/destination pairs: {seg1.Origin}→{seg1.Destination}, {seg2.Origin}→{seg2.Destination}"
        };
    }

    private static TripClassification ClassifyMultiSegment(List<SegmentInput> segments)
    {
        var first = segments[0];
        var last = segments[^1];

        if (string.Equals(first.Origin, last.Destination, StringComparison.OrdinalIgnoreCase))
        {
            return new TripClassification
            {
                Type = TripType.CircleTrip,
                SingleTicketPossible = true,
                RecommendedStrategies =
                [
                    TicketingStrategyType.SingleTicket,
                    TicketingStrategyType.SeparateOneWays,
                    TicketingStrategyType.HybridRtPlusOw
                ],
                Reasoning = $"Circle trip: {segments.Count} segments returning to origin {first.Origin}"
            };
        }

        return new TripClassification
        {
            Type = TripType.MultiCity,
            SingleTicketPossible = true,
            RecommendedStrategies =
            [
                TicketingStrategyType.SingleTicket,
                TicketingStrategyType.SeparateOneWays,
                TicketingStrategyType.CarrierOptimized
            ],
            Reasoning = $"Multi-city: {segments.Count} segments with no return to origin"
        };
    }
}
