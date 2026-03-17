namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmFareComponentDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("governingCarrier")]
    public string GoverningCarrier { get; set; } = string.Empty;

    [JsonPropertyName("fareAmount")]
    public decimal FareAmount { get; set; }

    [JsonPropertyName("fareCurrency")]
    public string FareCurrency { get; set; } = string.Empty;

    [JsonPropertyName("fareBasisCode")]
    public string FareBasisCode { get; set; } = string.Empty;

    [JsonPropertyName("farePassengerType")]
    public string FarePassengerType { get; set; } = string.Empty;

    [JsonPropertyName("directionality")]
    public string? Directionality { get; set; }

    [JsonPropertyName("cabinCode")]
    public string? Cabin { get; set; }

    [JsonPropertyName("segments")]
    public List<BfmFareSegment>? Segments { get; set; }

    [JsonPropertyName("brand")]
    public BfmBrandRef? Brand { get; set; }
}

public class BfmFareSegment
{
    [JsonPropertyName("segment")]
    public BfmFareSegmentDetail Segment { get; set; } = new();
}

public class BfmFareSegmentDetail
{
    [JsonPropertyName("bookingCode")]
    public string BookingCode { get; set; } = string.Empty;

    [JsonPropertyName("cabinCode")]
    public string CabinCode { get; set; } = string.Empty;

    [JsonPropertyName("availabilityBreak")]
    public bool AvailabilityBreak { get; set; }

    [JsonPropertyName("seatsAvailable")]
    public int SeatsAvailable { get; set; }
}

public class BfmBrandRef
{
    [JsonPropertyName("brandId")]
    public int BrandId { get; set; }

    [JsonPropertyName("brandName")]
    public string? BrandName { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("programCode")]
    public string? ProgramCode { get; set; }

    [JsonPropertyName("programDescription")]
    public string? ProgramDescription { get; set; }
}
