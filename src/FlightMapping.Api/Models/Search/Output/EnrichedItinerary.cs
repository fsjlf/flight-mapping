namespace FlightMapping.Api.Models.Search.Output;

using FlightMapping.Api.Models.Enums;

public class EnrichedItinerary
{
    public string Id { get; set; } = string.Empty;
    public TicketingStrategyType StrategyType { get; set; }
    public string StrategyDescription { get; set; } = string.Empty;
    public List<EnrichedSegment> Segments { get; set; } = new();
    public int TotalDurationMinutes { get; set; }
    public string TotalDurationFormatted { get; set; } = string.Empty;
    public int TotalMilesFlown { get; set; }
    public ItineraryPricing Pricing { get; set; } = new();
    public FarePolicy FarePolicy { get; set; } = new();
    public ItineraryScores Scores { get; set; } = new();
    public List<string> Highlights { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public int Rank { get; set; }
    public string ValidatingCarrier { get; set; } = string.Empty;
    public bool ETicketable { get; set; }
    public string? GoverningCarriers { get; set; }
    public string PricingSource { get; set; } = string.Empty;
    public List<int> CoveredSegmentIndices { get; set; } = new();

    /// <summary>For multi-airport searches: which route variant produced this result (e.g. "JFK→LHR / LHR→JFK")</summary>
    public string? RouteKey { get; set; }
}

public class FarePolicy
{
    public bool NonRefundable { get; set; }
    public bool Vita { get; set; }
}
