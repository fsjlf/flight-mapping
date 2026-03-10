namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmRequest
{
    [JsonPropertyName("OTA_AirLowFareSearchRQ")]
    public BfmSearchRq SearchRq { get; set; } = new();
}

public class BfmSearchRq
{
    [JsonPropertyName("Version")]
    public string Version { get; set; } = "5";

    [JsonPropertyName("POS")]
    public BfmPos Pos { get; set; } = new();

    [JsonPropertyName("OriginDestinationInformation")]
    public List<BfmOriginDestination> OriginDestinationInformation { get; set; } = new();

    [JsonPropertyName("TravelPreferences")]
    public BfmTravelPreferences TravelPreferences { get; set; } = new();

    [JsonPropertyName("TravelerInfoSummary")]
    public BfmTravelerInfo TravelerInfoSummary { get; set; } = new();

    [JsonPropertyName("TPA_Extensions")]
    public BfmTpaExtensions? TpaExtensions { get; set; }
}

public class BfmPos
{
    [JsonPropertyName("Source")]
    public List<BfmSource> Source { get; set; } = new();
}

public class BfmSource
{
    [JsonPropertyName("PseudoCityCode")]
    public string PseudoCityCode { get; set; } = string.Empty;

    [JsonPropertyName("RequestorID")]
    public BfmRequestorId RequestorId { get; set; } = new();
}

public class BfmRequestorId
{
    [JsonPropertyName("Type")]
    public string Type { get; set; } = "1";

    [JsonPropertyName("ID")]
    public string Id { get; set; } = "1";

    [JsonPropertyName("CompanyName")]
    public BfmCompanyName CompanyName { get; set; } = new();
}

public class BfmCompanyName
{
    [JsonPropertyName("Code")]
    public string Code { get; set; } = "TN";
}

public class BfmTpaExtensions
{
    [JsonPropertyName("IntelliSellTransaction")]
    public BfmIntelliSellTransaction IntelliSellTransaction { get; set; } = new();
}

public class BfmIntelliSellTransaction
{
    [JsonPropertyName("RequestType")]
    public BfmRequestType RequestType { get; set; } = new();
}

public class BfmRequestType
{
    [JsonPropertyName("Name")]
    public string Name { get; set; } = "200ITINS";
}
