namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmTravelPreferences
{
    [JsonPropertyName("ValidInterlineTicket")]
    public bool ValidInterlineTicket { get; set; } = true;

    /// <summary>
    /// Global cabin preference baseline. Always present — for mixed-cabin searches,
    /// per-OD TPA_Extensions.CabinPref overrides this per leg.
    /// </summary>
    [JsonPropertyName("CabinPref")]
    public List<BfmCabinPref> CabinPref { get; set; } = new();

    [JsonPropertyName("TPA_Extensions")]
    public BfmTravelPrefExtensions? TpaExtensions { get; set; }
}

public class BfmCabinPref
{
    [JsonPropertyName("Cabin")]
    public string Cabin { get; set; } = "Y";

    [JsonPropertyName("PreferLevel")]
    public string PreferLevel { get; set; } = "Preferred";
}

public class BfmTravelPrefExtensions
{
    [JsonPropertyName("NumTrips")]
    public BfmNumTrips? NumTrips { get; set; }

    [JsonPropertyName("DataSources")]
    public BfmDataSources? DataSources { get; set; }

    /// <summary>
    /// Trip type hint — "Return" for roundtrips, "OneWay" for one-ways.
    /// Helps Sabre with mixed-cabin pairing on roundtrip searches.
    /// </summary>
    [JsonPropertyName("TripType")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public BfmTripType? TripType { get; set; }
}

/// <summary>Trip type indicator for TravelPreferences TPA_Extensions.</summary>
public class BfmTripType
{
    [JsonPropertyName("Value")]
    public string Value { get; set; } = "Return";
}

public class BfmNumTrips
{
    [JsonPropertyName("Number")]
    public int Number { get; set; } = 200;
}

public class BfmDataSources
{
    [JsonPropertyName("ATPCO")]
    public string Atpco { get; set; } = "Enable";

    [JsonPropertyName("LCC")]
    public string Lcc { get; set; } = "Enable";

    [JsonPropertyName("NDC")]
    public string Ndc { get; set; } = "Disable";
}
