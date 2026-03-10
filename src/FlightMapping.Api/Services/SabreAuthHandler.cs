namespace FlightMapping.Api.Services;

using System.Net.Http.Headers;

public class SabreAuthHandler : DelegatingHandler
{
    private readonly ISabreTokenService _tokenService;

    public SabreAuthHandler(ISabreTokenService tokenService)
    {
        _tokenService = tokenService;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var token = await _tokenService.GetTokenAsync(cancellationToken);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await base.SendAsync(request, cancellationToken);
    }
}
