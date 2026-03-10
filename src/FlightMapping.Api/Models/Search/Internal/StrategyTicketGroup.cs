namespace FlightMapping.Api.Models.Search.Internal;

public class StrategyTicketGroup
{
    public string GroupId { get; set; } = string.Empty;
    public List<int> SegmentIndices { get; set; } = new();
    public string Label { get; set; } = string.Empty;
}
