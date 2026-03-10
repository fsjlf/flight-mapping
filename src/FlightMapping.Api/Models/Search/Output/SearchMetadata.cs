namespace FlightMapping.Api.Models.Search.Output;

public class SearchMetadata
{
    public int TotalResults { get; set; }
    public int StrategiesExecuted { get; set; }
    public int ApiCallsMade { get; set; }
    public long SearchDurationMs { get; set; }
    public List<StrategyResult> StrategyResults { get; set; } = new();
    public List<string> SabreMessages { get; set; } = new();
}

public class StrategyResult
{
    public string StrategyId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int ResultCount { get; set; }
    public long DurationMs { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}
