namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmTravelPreferences
{
    [JsonPropertyName("ValidInterlineTicket")]
    public bool ValidInterlineTicket { get; set; } = true;

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
