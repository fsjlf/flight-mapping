namespace FlightMapping.Api.Controllers;

using System.Text;
using FlightMapping.Api.Configuration;
using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Models.Sabre.Response;
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

    [HttpPost("export-csv")]
    public async Task<IActionResult> ExportCsv([FromBody] HotelExportRequest request, CancellationToken cancellationToken)
    {
        if (request.HotelCodes == null || request.HotelCodes.Count == 0)
            return BadRequest(new { error = "HotelCodes list is required" });

        if (string.IsNullOrWhiteSpace(request.CheckIn) || string.IsNullOrWhiteSpace(request.CheckOut))
            return BadRequest(new { error = "CheckIn and CheckOut dates are required" });

        var csv = new StringBuilder();
        csv.AppendLine("HotelCode,HotelName,ChainName,BrandName,SabreRating,RoomType,RoomTypeCode,RoomID,RoomCategory,RoomView,BedType,BedCount,RoomDescriptionName,RoomDescriptionText,RatePlanName,RatePlanCode,RatePlanType,RatePlanTypeDescription,ProductCode,PrepaidIndicator,CurrencyCode,AvgNightlyRate,AvgNightlyRateBeforeTax,AmountBeforeTax,AmountAfterTax,ApproxTotalPrice,RateSource,CancelDeadline,Refundable,PenaltyAmount,GuaranteeType,CheckIn,CheckOut");

        var completed = 0;
        var failed = 0;

        foreach (var hotelCode in request.HotelCodes.Distinct())
        {
            cancellationToken.ThrowIfCancellationRequested();

            _logger.LogInformation("Exporting hotel {HotelCode} ({Completed}/{Total})",
                hotelCode, completed + 1, request.HotelCodes.Distinct().Count());

            var sabreRequest = BuildSabreRequest(hotelCode, request);
            var (response, errorBody) = await _sabreClient.GetHotelDetailsAsync(sabreRequest, cancellationToken);

            if (response?.GetHotelDetailsRS?.HotelDetailsInfo == null)
            {
                _logger.LogWarning("Hotel {HotelCode} failed: {Error}", hotelCode, errorBody);
                csv.AppendLine($"{Esc(hotelCode)},ERROR: {Esc(errorBody ?? "No response")}");
                failed++;
                completed++;
                continue;
            }

            var info = response.GetHotelDetailsRS.HotelDetailsInfo;
            var hotel = info.HotelInfo;
            var rooms = info.HotelRateInfo?.Rooms?.Room;

            if (rooms == null || rooms.Count == 0)
            {
                csv.AppendLine($"{Esc(hotelCode)},{Esc(hotel?.HotelName)},{Esc(hotel?.ChainName)},{Esc(hotel?.BrandName)},{Esc(hotel?.SabreRating)},NO ROOMS RETURNED");
                completed++;
                continue;
            }

            foreach (var room in rooms)
            {
                var bedType = "";
                var bedCount = "";
                if (room.BedTypeOptions?.BedTypes?.Count > 0)
                {
                    var bt = room.BedTypeOptions.BedTypes[0].BedType;
                    if (bt?.Count > 0)
                    {
                        bedType = bt[0].Description ?? "";
                        bedCount = bt[0].Count?.ToString() ?? "";
                    }
                }

                var descName = room.RoomDescription?.Name ?? "";
                var descText = room.RoomDescription?.Text?.Count > 0 ? room.RoomDescription.Text[0] : "";

                var ratePlans = room.RatePlans?.RatePlan;
                if (ratePlans == null || ratePlans.Count == 0)
                {
                    csv.AppendLine(string.Join(",",
                        Esc(hotelCode), Esc(hotel?.HotelName), Esc(hotel?.ChainName), Esc(hotel?.BrandName), Esc(hotel?.SabreRating),
                        Esc(room.RoomType), Esc(room.RoomTypeCode?.ToString()), Esc(room.RoomID), Esc(room.RoomCategory),
                        Esc(room.RoomViewDescription), Esc(bedType), Esc(bedCount),
                        Esc(descName), Esc(descText),
                        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
                        Esc(request.CheckIn), Esc(request.CheckOut)));
                    continue;
                }

                foreach (var rp in ratePlans)
                {
                    var cri = rp.ConvertedRateInfo;
                    var cancelDeadline = "";
                    var refundable = "";
                    var penaltyAmt = "";
                    if (cri?.CancelPenalties?.CancelPenalty?.Count > 0)
                    {
                        var cp = cri.CancelPenalties.CancelPenalty[0];
                        cancelDeadline = cp.CancelDeadline ?? "";
                        refundable = cp.Refundable?.ToString() ?? "";
                        penaltyAmt = cp.PenaltyAmount?.Amount ?? "";
                    }

                    csv.AppendLine(string.Join(",",
                        Esc(hotelCode), Esc(hotel?.HotelName), Esc(hotel?.ChainName), Esc(hotel?.BrandName), Esc(hotel?.SabreRating),
                        Esc(room.RoomType), Esc(room.RoomTypeCode?.ToString()), Esc(room.RoomID), Esc(room.RoomCategory),
                        Esc(room.RoomViewDescription), Esc(bedType), Esc(bedCount),
                        Esc(descName), Esc(descText),
                        Esc(rp.RatePlanName), Esc(rp.RatePlanCode), Esc(rp.RatePlanType), Esc(rp.RatePlanTypeDescription),
                        Esc(rp.ProductCode), Esc(rp.PrepaidIndicator?.ToString()),
                        Esc(cri?.CurrencyCode), Esc(cri?.AverageNightlyRate), Esc(cri?.AverageNightlyRateBeforeTax),
                        Esc(cri?.AmountBeforeTax), Esc(cri?.AmountAfterTax), Esc(cri?.ApproxTotalPrice),
                        Esc(cri?.RateSource),
                        Esc(cancelDeadline), Esc(refundable), Esc(penaltyAmt),
                        Esc(cri?.Guarantee?.GuaranteeType),
                        Esc(request.CheckIn), Esc(request.CheckOut)));
                }
            }

            completed++;
        }

        _logger.LogInformation("Hotel CSV export complete: {Completed} hotels, {Failed} failed", completed, failed);

        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"hotel-rates-{request.CheckIn}-to-{request.CheckOut}.csv");
    }

    private static HotelDetailsRequest BuildSabreRequest(string hotelCode, HotelExportRequest request)
    {
        return new HotelDetailsRequest
        {
            GetHotelDetailsRQ = new GetHotelDetailsRQ
            {
                SearchCriteria = new HotelSearchCriteria
                {
                    HotelRefs = new HotelRefs
                    {
                        HotelRef = new HotelRef
                        {
                            HotelCode = hotelCode,
                            CodeContext = "SABRE"
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
    }

    private static string Esc(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}

public class HotelExportRequest
{
    public List<string> HotelCodes { get; set; } = new();
    public string CheckIn { get; set; } = string.Empty;
    public string CheckOut { get; set; } = string.Empty;
    public string? CurrencyCode { get; set; }
    public int Adults { get; set; } = 1;
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
