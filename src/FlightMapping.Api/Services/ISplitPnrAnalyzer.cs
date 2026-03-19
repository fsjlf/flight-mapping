namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;

public interface ISplitPnrAnalyzer
{
    /// <summary>
    /// Analyze a split PNR opportunity using price breakpoints from incremental probing.
    /// Reconstructs fare class availability from the breakpoint data and runs the full waterfall.
    /// </summary>
    SplitPnrAnalysis Analyze(SplitPnrAnalysisRequest request);
}

public class SplitPnrAnalysisRequest
{
    public string FlightKey { get; set; } = string.Empty;
    public string Carrier { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public Models.Enums.CabinClass Cabin { get; set; }
    public int TotalPassengers { get; set; }
    public int EstimatedPhysicalSeats { get; set; }
    public List<PriceBreakpoint> Breakpoints { get; set; } = new();
}
