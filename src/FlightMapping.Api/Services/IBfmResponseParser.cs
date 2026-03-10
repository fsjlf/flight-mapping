namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Sabre.Response;
using FlightMapping.Api.Models.Search.Internal;
using FlightMapping.Api.Models.Search.Output;

public interface IBfmResponseParser
{
    List<EnrichedItinerary> Parse(BfmGroupedResponse response, StrategyApiCall apiCall, SearchStrategy strategy);
}
