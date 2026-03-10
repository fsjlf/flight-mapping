namespace FlightMapping.Api.Models.Search.Output;

public class ItineraryPricing
{
    public decimal TotalPrice { get; set; }
    public decimal BasePrice { get; set; }
    public decimal TaxesAndFees { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public string BaseFareCurrency { get; set; } = string.Empty;
    public decimal? EquivalentAmount { get; set; }
    public string? EquivalentCurrency { get; set; }
    public decimal PricePerAdult { get; set; }
    public string PriceFormatted { get; set; } = string.Empty;
    public List<TaxBreakdown> Taxes { get; set; } = new();
    public List<PassengerPricing> PassengerBreakdown { get; set; } = new();
}

public class TaxBreakdown
{
    public string Code { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
}

public class PassengerPricing
{
    public string PassengerType { get; set; } = string.Empty;
    public int Count { get; set; }
    public bool NonRefundable { get; set; }
}
