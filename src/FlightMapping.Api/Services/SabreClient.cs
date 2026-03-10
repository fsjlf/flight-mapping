namespace FlightMapping.Api.Services;

using System.Text.Json;
using FlightMapping.Api.Configuration;
using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Models.Sabre.Response;
using Microsoft.Extensions.Options;

public class SabreClient : ISabreClient
{
    private readonly HttpClient _httpClient;
    private readonly SabreOptions _options;
    private readonly ILogger<SabreClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public SabreClient(
        HttpClient httpClient,
        IOptions<SabreOptions> options,
        ILogger<SabreClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/v1/lists/utilities/airlines", cancellationToken);
            _logger.LogInformation("Sabre connection test returned {StatusCode}", response.StatusCode);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sabre connection test failed");
            return false;
        }
    }

    public async Task<BfmGroupedResponse?> SearchFlightsAsync(BfmRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(request, JsonOptions);
            using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending BFM request to /v4/offers/shop");
            _logger.LogDebug("BFM request body: {RequestBody}", json);

            var response = await _httpClient.PostAsync("/v4/offers/shop", content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("BFM request failed with {StatusCode}: {Error}", response.StatusCode, responseBody);
                return null;
            }

            _logger.LogDebug("BFM response body: {ResponseBody}", responseBody);
            var result = JsonSerializer.Deserialize<BfmGroupedResponse>(responseBody, JsonOptions);

            var itinCount = result?.GroupedItineraryResponse?.Statistics?.ItineraryCount ?? 0;
            _logger.LogInformation("BFM returned {ItineraryCount} itineraries", itinCount);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BFM search request failed");
            return null;
        }
    }
}
