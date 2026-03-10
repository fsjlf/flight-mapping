namespace FlightMapping.Api.Models.Search.Input;

using FlightMapping.Api.Models.Enums;

public class SegmentInput
{
    public string Origin { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateOnly DepartureDate { get; set; }
    public DepartureTimeWindow? TimePreference { get; set; }
    public CabinClass? CabinOverride { get; set; }
}
