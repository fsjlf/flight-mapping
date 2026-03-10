namespace FlightMapping.Api.Services;

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FlightMapping.Api.Configuration;
using FlightMapping.Api.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

public class SabreTokenService : ISabreTokenService
{
    private const string CacheKey = "SabreAccessToken";
    private static readonly SemaphoreSlim TokenLock = new(1, 1);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly SabreOptions _options;
    private readonly ILogger<SabreTokenService> _logger;

    public SabreTokenService(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        IOptions<SabreOptions> options,
        ILogger<SabreTokenService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> GetTokenAsync(CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(CacheKey, out string? cachedToken) && !string.IsNullOrEmpty(cachedToken))
            return cachedToken;

        await TokenLock.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring lock
            if (_cache.TryGetValue(CacheKey, out cachedToken) && !string.IsNullOrEmpty(cachedToken))
                return cachedToken;

            return await RequestNewTokenAsync(cancellationToken);
        }
        finally
        {
            TokenLock.Release();
        }
    }

    private async Task<string> RequestNewTokenAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Requesting new Sabre access token from {Endpoint}", _options.TokenEndpoint);

        var client = _httpClientFactory.CreateClient("SabreAuth");

        // Sabre credential format: V1:{clientId}:{groupId}:AA
        var formattedClientId = $"V1:{_options.ClientId}:{_options.GroupId.ToUpperInvariant()}:AA";

        // Sabre double-encoding: Base64(Base64(formattedClientId):Base64(clientSecret))
        var encodedClientId = Convert.ToBase64String(Encoding.UTF8.GetBytes(formattedClientId));
        var encodedSecret = Convert.ToBase64String(Encoding.UTF8.GetBytes(_options.ClientSecret));
        var combined = $"{encodedClientId}:{encodedSecret}";
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(combined));

        var request = new HttpRequestMessage(HttpMethod.Post, _options.TokenEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new StringContent(
            "grant_type=client_credentials",
            Encoding.UTF8,
            "application/x-www-form-urlencoded");

        var response = await client.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Sabre token request failed with {StatusCode}: {Body}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Sabre token request failed: {response.StatusCode} - {errorBody}");
        }

        var tokenResponse = await response.Content.ReadFromJsonAsync<SabreTokenResponse>(cancellationToken)
            ?? throw new InvalidOperationException("Failed to deserialize Sabre token response");

        // Cache with buffer: expire 5 min early (or 10% of lifetime, whichever is smaller)
        var bufferSeconds = Math.Min(300, tokenResponse.ExpiresIn / 10);
        var cacheExpiry = TimeSpan.FromSeconds(tokenResponse.ExpiresIn - bufferSeconds);
        _cache.Set(CacheKey, tokenResponse.AccessToken, cacheExpiry);

        _logger.LogInformation(
            "Sabre token acquired, expires in {ExpiresIn}s (cached for {CacheSeconds}s)",
            tokenResponse.ExpiresIn, cacheExpiry.TotalSeconds);

        return tokenResponse.AccessToken;
    }
}
