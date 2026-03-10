namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmOriginDestination
{
    [JsonPropertyName("RPH")]
    public string Rph { get; set; } = string.Empty;

    [JsonPropertyName("DepartureDateTime")]
    public string DepartureDateTime { get; set; } = string.Empty;

    [JsonPropertyName("OriginLocation")]
    public BfmLocation OriginLocation { get; set; } = new();

    [JsonPropertyName("DestinationLocation")]
    public BfmLocation DestinationLocation { get; set; } = new();
}

public class BfmLocation
{
    [JsonPropertyName("LocationCode")]
    public string LocationCode { get; set; } = string.Empty;
}
