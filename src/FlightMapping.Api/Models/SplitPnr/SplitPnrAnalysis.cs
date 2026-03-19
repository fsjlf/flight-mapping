namespace FlightMapping.Api.Models.SplitPnr;

using FlightMapping.Api.Models.Enums;

public class SplitPnrAnalysis
{
    public string FlightKey { get; set; } = string.Empty;
    public string Carrier { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public CabinClass Cabin { get; set; }
    public int TotalPassengers { get; set; }

    public SingleBookingOption SingleBooking { get; set; } = new();
    public SplitBookingOption RecommendedSplit { get; set; } = new();
    public WaterfallResult Waterfall { get; set; } = new();

    public decimal Savings { get; set; }
    public double SavingsPercent { get; set; }
    public decimal AveragePricePerPerson { get; set; }

    public List<string> TradeOffs { get; set; } = new();
    public List<PriceBreakpoint> PriceBreakpoints { get; set; } = new();
}

public class SingleBookingOption
{
    public string Rbd { get; set; } = string.Empty;
    public decimal PricePerPerson { get; set; }
    public decimal Total { get; set; }
    public string? BrandName { get; set; }
    public string? RulesSummary { get; set; }
}

public class SplitBookingOption
{
    public List<PnrGroup> Pnrs { get; set; } = new();
    public decimal Total { get; set; }
    public decimal AveragePerPerson { get; set; }
}

public class PnrGroup
{
    public int PnrNumber { get; set; }
    public string Rbd { get; set; } = string.Empty;
    public int PassengerCount { get; set; }
    public decimal FarePerPerson { get; set; }
    public decimal Subtotal { get; set; }
    public string? BrandName { get; set; }
    public string? RulesSummary { get; set; }
}

public class PriceBreakpoint
{
    public int PassengerCount { get; set; }
    public string Rbd { get; set; } = string.Empty;
    public decimal PricePerPerson { get; set; }
    public int InferredAuthCap { get; set; }
}
