namespace FlightMapping.Api.Models.Search.Internal;

using FlightMapping.Api.Models.Enums;

public class TripClassification
{
    public TripType Type { get; set; }
    public bool SingleTicketPossible { get; set; }
    public List<TicketingStrategyType> RecommendedStrategies { get; set; } = new();
    public string Reasoning { get; set; } = string.Empty;
}
