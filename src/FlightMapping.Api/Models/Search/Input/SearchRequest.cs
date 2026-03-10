namespace FlightMapping.Api.Models.Search.Input;

public class SearchRequest
{
    public List<SegmentInput> Segments { get; set; } = new();
    public PassengerConfig Passengers { get; set; } = new();
    public SearchPreferences? Preferences { get; set; }
}
