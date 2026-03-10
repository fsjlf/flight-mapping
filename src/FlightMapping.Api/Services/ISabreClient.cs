namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Models.Sabre.Response;

public interface ISabreClient
{
    Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default);
    Task<BfmGroupedResponse?> SearchFlightsAsync(BfmRequest request, CancellationToken cancellationToken = default);
}
