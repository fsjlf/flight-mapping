namespace FlightMapping.Api.Models.Search.Internal;

using FlightMapping.Api.Models.Enums;

public class SearchStrategy
{
    public string Id { get; set; } = string.Empty;
    public TicketingStrategyType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<StrategyTicketGroup> TicketGroups { get; set; } = new();
    public string Hypothesis { get; set; } = string.Empty;
    public int Priority { get; set; }
    public List<StrategyApiCall> ApiCalls { get; set; } = new();
}
