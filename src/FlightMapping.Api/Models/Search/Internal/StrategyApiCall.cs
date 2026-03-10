namespace FlightMapping.Api.Models.Search.Internal;

public class StrategyApiCall
{
    public string CallId { get; set; } = string.Empty;
    public string StrategyId { get; set; } = string.Empty;
    public string TicketGroupId { get; set; } = string.Empty;
    public List<int> SegmentIndices { get; set; } = new();
    public int Wave { get; set; }
}
