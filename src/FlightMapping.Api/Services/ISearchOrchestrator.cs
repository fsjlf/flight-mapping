namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Output;

public interface ISearchOrchestrator
{
    Task<SearchResponse> SearchAsync(SearchRequest request, CancellationToken cancellationToken = default);
}
