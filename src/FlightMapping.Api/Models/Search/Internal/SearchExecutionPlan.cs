namespace FlightMapping.Api.Models.Search.Internal;

public class SearchExecutionPlan
{
    public string PlanId { get; set; } = string.Empty;
    public TripClassification Classification { get; set; } = null!;
    public List<SearchStrategy> Strategies { get; set; } = new();
    public int TotalApiCalls { get; set; }
    public int ExecutionWaves { get; set; }
}
