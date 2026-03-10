namespace FlightMapping.Api.Services;

public interface ISabreTokenService
{
    Task<string> GetTokenAsync(CancellationToken cancellationToken = default);
}
