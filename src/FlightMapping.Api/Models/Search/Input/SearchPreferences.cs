namespace FlightMapping.Api.Models.Search.Input;

using FlightMapping.Api.Models.Enums;

public class SearchPreferences
{
    public CabinClass Cabin { get; set; } = CabinClass.Economy;

    /// <summary>
    /// Multi-cabin search: when set, each cabin class generates a separate CabinPref in BFM.
    /// Takes priority over the single <see cref="Cabin"/> property.
    /// </summary>
    public List<CabinClass>? Cabins { get; set; }

    public List<string>? PreferredCarriers { get; set; }
    public List<string>? ExcludedCarriers { get; set; }
    public int? MaxStops { get; set; }
    public FareType FareType { get; set; } = FareType.Published;
    public decimal? MaxBudgetPerPerson { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public SearchPriority Priority { get; set; } = SearchPriority.Balanced;
    public bool IncludeBrandedFares { get; set; } = true;

    /// <summary>
    /// Returns the effective list of cabins for BFM — uses <see cref="Cabins"/> if set,
    /// otherwise falls back to the single <see cref="Cabin"/>.
    /// </summary>
    public List<CabinClass> EffectiveCabins =>
        Cabins is { Count: > 0 } ? Cabins : [Cabin];
}
