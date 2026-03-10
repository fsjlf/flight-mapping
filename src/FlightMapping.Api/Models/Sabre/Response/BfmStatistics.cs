namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmStatistics
{
    [JsonPropertyName("itineraryCount")]
    public int ItineraryCount { get; set; }
}

public class BfmTaxDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;
}

public class BfmTaxSummaryDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;
}

public class BfmValidatingCarrierDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("settlementMethod")]
    public string? SettlementMethod { get; set; }

    [JsonPropertyName("newVcxProcess")]
    public bool NewVcxProcess { get; set; }

    [JsonPropertyName("default")]
    public BfmValidatingCarrierDefault? Default { get; set; }
}

public class BfmValidatingCarrierDefault
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;
}

public class BfmBrandFeatureDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("commercialName")]
    public string CommercialName { get; set; } = string.Empty;

    [JsonPropertyName("application")]
    public string? Application { get; set; }

    [JsonPropertyName("serviceGroup")]
    public string? ServiceGroup { get; set; }

    [JsonPropertyName("serviceType")]
    public string? ServiceType { get; set; }
}

public class BfmBrandDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("brandTier")]
    public int BrandTier { get; set; }
}
