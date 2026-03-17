namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;

public interface IAiParseService
{
    Task<SearchRequest> ParseAsync(string naturalLanguageInput, CancellationToken cancellationToken);
}
