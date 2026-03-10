namespace FlightMapping.Api.Models.Sabre.Response;

using System.Text.Json.Serialization;

public class BfmScheduleDesc
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("departure")]
    public BfmSchedulePoint Departure { get; set; } = new();

    [JsonPropertyName("arrival")]
    public BfmSchedulePoint Arrival { get; set; } = new();

    [JsonPropertyName("carrier")]
    public BfmCarrier Carrier { get; set; } = new();

    [JsonPropertyName("elapsedTime")]
    public int ElapsedTime { get; set; }

    [JsonPropertyName("totalMilesFlown")]
    public int TotalMilesFlown { get; set; }

    [JsonPropertyName("eTicketable")]
    public bool ETicketable { get; set; }

    [JsonPropertyName("stopCount")]
    public int StopCount { get; set; }
}

public class BfmSchedulePoint
{
    [JsonPropertyName("airport")]
    public string Airport { get; set; } = string.Empty;

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("country")]
    public string? Country { get; set; }

    [JsonPropertyName("time")]
    public string Time { get; set; } = string.Empty;

    [JsonPropertyName("dateAdjustment")]
    public int DateAdjustment { get; set; }
}

public class BfmCarrier
{
    [JsonPropertyName("marketing")]
    public string Marketing { get; set; } = string.Empty;

    [JsonPropertyName("marketingFlightNumber")]
    public int MarketingFlightNumber { get; set; }

    [JsonPropertyName("operating")]
    public string? Operating { get; set; }

    [JsonPropertyName("operatingFlightNumber")]
    public int OperatingFlightNumber { get; set; }

    [JsonPropertyName("disclosure")]
    public string? Disclosure { get; set; }

    [JsonPropertyName("equipment")]
    public BfmEquipment? Equipment { get; set; }
}

public class BfmEquipment
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("typeForFirstLeg")]
    public string? TypeForFirstLeg { get; set; }

    [JsonPropertyName("typeForLastLeg")]
    public string? TypeForLastLeg { get; set; }
}
