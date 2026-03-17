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
}
