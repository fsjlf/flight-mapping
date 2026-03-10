namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmPricingInformation
{
    [JsonPropertyName("pricingSubsource")]
    public string? PricingSubsource { get; set; }

    [JsonPropertyName("fare")]
    public BfmFare Fare { get; set; } = new();
}

public class BfmFare
{
    [JsonPropertyName("validatingCarrierCode")]
    public string ValidatingCarrierCode { get; set; } = string.Empty;

    [JsonPropertyName("vita")]
    public bool Vita { get; set; }

    [JsonPropertyName("eTicketable")]
    public bool ETicketable { get; set; }

    [JsonPropertyName("governingCarriers")]
    public string? GoverningCarriers { get; set; }

    [JsonPropertyName("passengerInfoList")]
    public List<BfmPassengerInfo> PassengerInfoList { get; set; } = new();

    [JsonPropertyName("totalFare")]
    public BfmTotalFare TotalFare { get; set; } = new();
}

public class BfmTotalFare
{
    [JsonPropertyName("totalPrice")]
    public decimal TotalPrice { get; set; }

    [JsonPropertyName("totalTaxAmount")]
    public decimal TotalTaxAmount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("baseFareAmount")]
    public decimal BaseFareAmount { get; set; }

    [JsonPropertyName("baseFareCurrency")]
    public string BaseFareCurrency { get; set; } = string.Empty;

    [JsonPropertyName("constructionAmount")]
    public decimal ConstructionAmount { get; set; }

    [JsonPropertyName("constructionCurrency")]
    public string? ConstructionCurrency { get; set; }

    [JsonPropertyName("equivalentAmount")]
    public decimal? EquivalentAmount { get; set; }

    [JsonPropertyName("equivalentCurrency")]
    public string? EquivalentCurrency { get; set; }
}

public class BfmPassengerInfo
{
    [JsonPropertyName("passengerInfo")]
    public BfmPassengerInfoDetail PassengerInfo { get; set; } = new();
}

public class BfmPassengerInfoDetail
{
    [JsonPropertyName("passengerType")]
    public string PassengerType { get; set; } = string.Empty;

    [JsonPropertyName("passengerNumber")]
    public int PassengerNumber { get; set; }

    [JsonPropertyName("nonRefundable")]
    public bool NonRefundable { get; set; }

    [JsonPropertyName("fareComponents")]
    public List<BfmFareComponentRef>? FareComponents { get; set; }
}

public class BfmFareComponentRef
{
    [JsonPropertyName("ref")]
    public int Ref { get; set; }

    [JsonPropertyName("segments")]
    public List<BfmFareComponentSegmentRef>? Segments { get; set; }

    [JsonPropertyName("brandFeatures")]
    public List<BfmBrandFeatureRef>? BrandFeatures { get; set; }
}

public class BfmBrandFeatureRef
{
    [JsonPropertyName("ref")]
    public int Ref { get; set; }
}

public class BfmFareComponentSegmentRef
{
    [JsonPropertyName("segment")]
    public BfmSegmentBookingDetail? Segment { get; set; }
}

public class BfmSegmentBookingDetail
{
    [JsonPropertyName("bookingCode")]
    public string BookingCode { get; set; } = string.Empty;

    [JsonPropertyName("cabinCode")]
    public string CabinCode { get; set; } = string.Empty;

    [JsonPropertyName("mealCode")]
    public string? MealCode { get; set; }

    [JsonPropertyName("seatsAvailable")]
    public int SeatsAvailable { get; set; }
}
