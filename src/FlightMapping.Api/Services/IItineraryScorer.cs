namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Output;

public interface IItineraryScorer
{
    void ScoreAll(List<EnrichedItinerary> itineraries, SearchPriority priority, SearchRequest request);
}
