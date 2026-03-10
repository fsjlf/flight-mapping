namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmTravelerInfo
{
    [JsonPropertyName("SeatsRequested")]
    public List<int> SeatsRequested { get; set; } = new();

    [JsonPropertyName("AirTravelerAvail")]
    public List<BfmAirTravelerAvail> AirTravelerAvail { get; set; } = new();

    [JsonPropertyName("PriceRequestInformation")]
    public BfmPriceRequestInformation? PriceRequestInformation { get; set; }
}

public class BfmPriceRequestInformation
{
    [JsonPropertyName("TPA_Extensions")]
    public BfmPriceReqExtensions? TpaExtensions { get; set; }
}

public class BfmPriceReqExtensions
{
    [JsonPropertyName("BrandedFareIndicators")]
    public BfmBrandedFareIndicators? BrandedFareIndicators { get; set; }
}

public class BfmBrandedFareIndicators
{
    [JsonPropertyName("ReturnBrandAncillaries")]
    public bool ReturnBrandAncillaries { get; set; } = true;

    [JsonPropertyName("SingleBrandedFare")]
    public bool SingleBrandedFare { get; set; }

    [JsonPropertyName("MultipleBrandedFares")]
    public bool MultipleBrandedFares { get; set; } = true;
}

public class BfmAirTravelerAvail
{
    [JsonPropertyName("PassengerTypeQuantity")]
    public List<BfmPassengerTypeQuantity> PassengerTypeQuantity { get; set; } = new();
}

public class BfmPassengerTypeQuantity
{
    [JsonPropertyName("Code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("Quantity")]
    public int Quantity { get; set; }
}
