namespace FlightMapping.Api.Models.Search.Output;

using FlightMapping.Api.Models.Search.Internal;
using FlightMapping.Api.Models.SplitPnr;

public class SearchResponse
{
    public string SearchId { get; set; } = string.Empty;
    public TripClassification Classification { get; set; } = null!;
    public List<EnrichedItinerary> Itineraries { get; set; } = new();
    public SearchMetadata Metadata { get; set; } = new();
    public List<SplitPnrDetection>? SplitPnrOpportunities { get; set; }
}
