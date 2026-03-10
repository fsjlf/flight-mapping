namespace FlightMapping.Api.Models.Search.Output;

public class EnrichedLeg
{
    public string Origin { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public string? OriginCity { get; set; }
    public string? OriginCountry { get; set; }
    public string? DestinationCity { get; set; }
    public string? DestinationCountry { get; set; }
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public int DurationMinutes { get; set; }
    public string MarketingCarrier { get; set; } = string.Empty;
    public int MarketingFlightNumber { get; set; }
    public string OperatingCarrier { get; set; } = string.Empty;
    public int OperatingFlightNumber { get; set; }
    public string? Disclosure { get; set; }
    public string FlightNumber { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string BookingClass { get; set; } = string.Empty;
    public string? MealCode { get; set; }
    public int SeatsAvailable { get; set; }
    public int TotalMilesFlown { get; set; }
    public int StopCount { get; set; }
    public int? ConnectionTimeToNextMinutes { get; set; }
}
