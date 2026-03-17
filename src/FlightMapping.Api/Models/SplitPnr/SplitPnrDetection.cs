namespace FlightMapping.Api.Models.SplitPnr;

public class SplitPnrDetection
{
    public bool OpportunityDetected { get; set; }
    public string FlightKey { get; set; } = string.Empty;
    public decimal SinglePaxPrice { get; set; }
    public string SinglePaxRbd { get; set; } = string.Empty;
    public decimal GroupPricePerPerson { get; set; }
    public string GroupRbd { get; set; } = string.Empty;
    public decimal DeltaPerPerson { get; set; }
    public int TotalPassengers { get; set; }
    public decimal MinEstimatedSavings { get; set; }
    public decimal MaxEstimatedSavings { get; set; }
    public string SavingsBadge { get; set; } = string.Empty; // "green", "yellow", "none"
    public int CheapSeatsAvailable { get; set; } // exact auth cap from incremental probing

    /// <summary>Multi-tier allocation from incremental probing (e.g. 3×P + 1×Z + 1×C)</summary>
    public List<SplitAllocationTier> Tiers { get; set; } = new();
}

public class SplitAllocationTier
{
    public string Rbd { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal PricePerPerson { get; set; }
    public decimal Subtotal => Count * PricePerPerson;
}
