namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmItineraryGroup
{
    [JsonPropertyName("groupDescription")]
    public BfmGroupDescription GroupDescription { get; set; } = new();

    [JsonPropertyName("itineraries")]
    public List<BfmItinerary> Itineraries { get; set; } = new();
}

public class BfmGroupDescription
{
    [JsonPropertyName("legDescriptions")]
    public List<BfmLegDescription> LegDescriptions { get; set; } = new();
}

public class BfmLegDescription
{
    [JsonPropertyName("departureDate")]
    public string DepartureDate { get; set; } = string.Empty;

    [JsonPropertyName("departureLocation")]
    public string DepartureLocation { get; set; } = string.Empty;

    [JsonPropertyName("arrivalLocation")]
    public string ArrivalLocation { get; set; } = string.Empty;
}
