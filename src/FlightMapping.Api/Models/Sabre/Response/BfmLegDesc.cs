namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmLegDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("schedules")]
    public List<BfmLegScheduleRef> Schedules { get; set; } = new();

    [JsonPropertyName("elapsedTime")]
    public int ElapsedTime { get; set; }
}

public class BfmLegScheduleRef
{
    [JsonPropertyName("ref")]
    public int Ref { get; set; }

    [JsonPropertyName("departureDateAdjustment")]
    public int DepartureDateAdjustment { get; set; }
}
