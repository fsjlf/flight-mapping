namespace FlightMapping.Api.Models.Search.Input;

using FlightMapping.Api.Models.Enums;

public class SearchPreferences
{
    public CabinClass Cabin { get; set; } = CabinClass.Economy;
    public List<string>? PreferredCarriers { get; set; }
    public List<string>? ExcludedCarriers { get; set; }
    public int? MaxStops { get; set; }
    public FareType FareType { get; set; } = FareType.Published;
    public decimal? MaxBudgetPerPerson { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public SearchPriority Priority { get; set; } = SearchPriority.Balanced;
    public bool IncludeBrandedFares { get; set; } = true;
}
