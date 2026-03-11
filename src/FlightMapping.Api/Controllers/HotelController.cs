namespace FlightMapping.Api.Controllers;

using FlightMapping.Api.Configuration;
using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class HotelController : ControllerBase
{
    private readonly ISabreClient _sabreClient;
    private readonly ILogger<HotelController> _logger;

    public HotelController(ISabreClient sabreClient, ILogger<HotelController> logger)
    {
        _sabreClient = sabreClient;
        _logger = logger;
    }

    [HttpPost("details")]
    public async Task<IActionResult> GetDetails([FromBody] HotelDetailsApiRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.HotelCode))
            return BadRequest(new { error = "HotelCode is required" });

        if (string.IsNullOrWhiteSpace(request.CheckIn) || string.IsNullOrWhiteSpace(request.CheckOut))
            return BadRequest(new { error = "CheckIn and CheckOut dates are required" });

        _logger.LogInformation("Hotel details request for {HotelCode}, {CheckIn} to {CheckOut}",
            request.HotelCode, request.CheckIn, request.CheckOut);

        var sabreRequest = new HotelDetailsRequest
        {
            GetHotelDetailsRQ = new GetHotelDetailsRQ
            {
                SearchCriteria = new HotelSearchCriteria
                {
                    HotelRefs = new HotelRefs
                    {
                        HotelRef = new HotelRef
                        {
                            HotelCode = request.HotelCode,
                            CodeContext = request.CodeContext ?? "SABRE"
                        }
                    },
                    RateInfoRef = new RateInfoRef
                    {
                        CurrencyCode = request.CurrencyCode ?? "USD",
                        StayDateTimeRange = new StayDateRange
                        {
                            StartDate = request.CheckIn,
                            EndDate = request.CheckOut
                        },
                        Rooms = new HotelRooms
                        {
                            Room = new List<HotelRoom>
                            {
                                new() { Index = 1, Adults = request.Adults }
                            }
                        }
                    },
                    HotelContentRef = new HotelContentRef
                    {
                        DescriptiveInfoRef = new DescriptiveInfoRef
                        {
                            PropertyInfo = true,
                            LocationInfo = true,
                            Amenities = true,
                            Descriptions = new HotelDescriptions
                            {
                                Description = new List<HotelDescriptionType>
                                {
                                    new() { Type = "ShortDescription" },
                                    new() { Type = "CancellationPolicy" }
                                }
                            }
                        }
                    }
                }
            }
        };

        var (response, errorBody) = await _sabreClient.GetHotelDetailsAsync(sabreRequest, cancellationToken);

        if (response == null)
            return StatusCode(502, new { error = "Failed to get hotel details from Sabre", sabreError = errorBody });

        return Ok(response);
    }

    [HttpPost("raw")]
    public async Task<IActionResult> RawDetails([FromBody] System.Text.Json.JsonElement body, CancellationToken cancellationToken)
    {
        var json = body.GetRawText();
        _logger.LogInformation("Raw hotel request: {Body}", json);

        var tokenService = HttpContext.RequestServices.GetRequiredService<ISabreTokenService>();
        var token = await tokenService.GetTokenAsync(cancellationToken);

        var options = HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Options.IOptions<SabreOptions>>().Value;
        using var httpClient = new System.Net.Http.HttpClient();
        var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, $"{options.BaseUrl}/v5/get/hoteldetails");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");

        var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        return Content(responseBody, "application/json");
    }
}

public class HotelDetailsApiRequest
{
    public string HotelCode { get; set; } = string.Empty;
    public string? CodeContext { get; set; }
    public string CheckIn { get; set; } = string.Empty;
    public string CheckOut { get; set; } = string.Empty;
    public string? CurrencyCode { get; set; }
    public int Adults { get; set; } = 1;
}
