namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmItinerary
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("pricingSource")]
    public string PricingSource { get; set; } = string.Empty;

    [JsonPropertyName("legs")]
    public List<BfmItineraryLegRef> Legs { get; set; } = new();

    [JsonPropertyName("pricingInformation")]
    public List<BfmPricingInformation> PricingInformation { get; set; } = new();
}

public class BfmItineraryLegRef
{
    [JsonPropertyName("ref")]
    public int Ref { get; set; }
}
