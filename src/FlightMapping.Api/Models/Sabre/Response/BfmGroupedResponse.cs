namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmGroupedResponse
{
    [JsonPropertyName("groupedItineraryResponse")]
    public BfmGroupedItineraryResponse GroupedItineraryResponse { get; set; } = new();
}

public class BfmGroupedItineraryResponse
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("messages")]
    public List<BfmMessage>? Messages { get; set; }

    [JsonPropertyName("statistics")]
    public BfmStatistics? Statistics { get; set; }

    [JsonPropertyName("scheduleDescs")]
    public List<BfmScheduleDesc> ScheduleDescs { get; set; } = new();

    [JsonPropertyName("taxDescs")]
    public List<BfmTaxDesc>? TaxDescs { get; set; }

    [JsonPropertyName("taxSummaryDescs")]
    public List<BfmTaxSummaryDesc>? TaxSummaryDescs { get; set; }

    [JsonPropertyName("fareComponentDescs")]
    public List<BfmFareComponentDesc>? FareComponentDescs { get; set; }

    [JsonPropertyName("validatingCarrierDescs")]
    public List<BfmValidatingCarrierDesc>? ValidatingCarrierDescs { get; set; }

    [JsonPropertyName("legDescs")]
    public List<BfmLegDesc> LegDescs { get; set; } = new();

    [JsonPropertyName("itineraryGroups")]
    public List<BfmItineraryGroup> ItineraryGroups { get; set; } = new();

    [JsonPropertyName("brandFeatureDescs")]
    public List<BfmBrandFeatureDesc>? BrandFeatureDescs { get; set; }

    [JsonPropertyName("brandDescs")]
    public List<BfmBrandDesc>? BrandDescs { get; set; }
}

public class BfmMessage
{
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
}
