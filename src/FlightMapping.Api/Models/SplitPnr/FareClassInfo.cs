namespace FlightMapping.Api.Models.SplitPnr;

using FlightMapping.Api.Models.Enums;

public class FareClassInfo
{
    public string Rbd { get; set; } = string.Empty;
    public int AuthCap { get; set; }
    public decimal FarePerPerson { get; set; }
    public string FareBasisCode { get; set; } = string.Empty;
    public CabinClass Cabin { get; set; }
    public string? BrandName { get; set; }
    public string? RulesSummary { get; set; }
}
