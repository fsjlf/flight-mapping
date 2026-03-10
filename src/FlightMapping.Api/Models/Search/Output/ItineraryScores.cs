namespace FlightMapping.Api.Models.Search.Output;

public class ItineraryScores
{
    public double Overall { get; set; }
    public double ValueScore { get; set; }
    public double ScheduleScore { get; set; }
    public double DurationScore { get; set; }
    public double ComfortScore { get; set; }
    public double ReliabilityScore { get; set; }
}
