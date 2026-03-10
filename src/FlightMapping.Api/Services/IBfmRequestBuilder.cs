namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;

public interface IBfmRequestBuilder
{
    BfmRequest Build(StrategyApiCall apiCall, SearchRequest searchRequest);
}
