namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Output;

public interface IResultEnricher
{
    void Enrich(EnrichedItinerary itinerary);
}
