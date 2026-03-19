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

    // Hotel APIs use PascalCase property names unlike BFM
    private static readonly JsonSerializerOptions PascalJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
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

    public async Task<(HotelDetailsResponse? Response, string? ErrorBody)> GetHotelDetailsAsync(HotelDetailsRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(request, PascalJsonOptions);
            using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending GetHotelDetails request to /v5/get/hoteldetails");
            _logger.LogDebug("Hotel details request body: {RequestBody}", json);

            var response = await _httpClient.PostAsync("/v5/get/hoteldetails", content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Hotel details request failed with {StatusCode}: {Error}", response.StatusCode, responseBody);
                return (null, responseBody);
            }

            _logger.LogDebug("Hotel details response body: {ResponseBody}", responseBody);
            return (JsonSerializer.Deserialize<HotelDetailsResponse>(responseBody, PascalJsonOptions), null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Hotel details request failed");
            return (null, ex.Message);
        }
    }

    public async Task<BfmGroupedResponse?> SearchFlightsAsync(BfmRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(request, JsonOptions);
            using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending BFM request to /v4/offers/shop");
            _logger.LogInformation("BFM request body (cabins debug): {RequestBody}", json);

            var response = await _httpClient.PostAsync("/v4/offers/shop", content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("BFM request failed with {StatusCode}: {Error}", response.StatusCode, responseBody);
                return null;
            }

            // Temporarily elevated to Information for mixed-cabin debugging
            _logger.LogInformation("BFM response body (first 2000 chars): {ResponseBody}",
                responseBody.Length > 2000 ? responseBody[..2000] + "..." : responseBody);
            var result = JsonSerializer.Deserialize<BfmGroupedResponse>(responseBody, JsonOptions);

            var itinCount = result?.GroupedItineraryResponse?.Statistics?.ItineraryCount ?? 0;
            _logger.LogInformation("BFM returned {ItineraryCount} itineraries", itinCount);

            // Log fare component cabin distribution to verify mixed-cabin in raw response
            if (result?.GroupedItineraryResponse?.FareComponentDescs != null)
            {
                var fcCabins = result.GroupedItineraryResponse.FareComponentDescs
                    .Where(fc => !string.IsNullOrEmpty(fc.Cabin))
                    .GroupBy(fc => fc.Cabin)
                    .Select(g => $"{g.Key}={g.Count()}")
                    .ToList();
                var fcDirs = result.GroupedItineraryResponse.FareComponentDescs
                    .Where(fc => !string.IsNullOrEmpty(fc.Directionality))
                    .GroupBy(fc => $"{fc.Directionality}:{fc.Cabin ?? "?"}")
                    .Select(g => $"{g.Key}={g.Count()}")
                    .ToList();
                _logger.LogInformation("BFM fare component cabins: [{FcCabins}] — directions: [{FcDirs}]",
                    string.Join(", ", fcCabins), string.Join(", ", fcDirs));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BFM search request failed");
            return null;
        }
    }
}
