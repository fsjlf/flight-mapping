namespace FlightMapping.Api.Models.Sabre.Request;

using System.Text.Json.Serialization;

public class BfmOriginDestination
{
    [JsonPropertyName("RPH")]
    public string Rph { get; set; } = string.Empty;

    [JsonPropertyName("DepartureDateTime")]
    public string DepartureDateTime { get; set; } = string.Empty;

    [JsonPropertyName("OriginLocation")]
    public BfmLocation OriginLocation { get; set; } = new();

    [JsonPropertyName("DestinationLocation")]
    public BfmLocation DestinationLocation { get; set; } = new();

    /// <summary>
    /// Per-OD extensions — used to set cabin preference per leg (e.g. Business outbound, Economy return)
    /// and segment type for mixed-cabin searches.
    /// </summary>
    [JsonPropertyName("TPA_Extensions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public BfmOdTpaExtensions? TpaExtensions { get; set; }
}

public class BfmLocation
{
    [JsonPropertyName("LocationCode")]
    public string LocationCode { get; set; } = string.Empty;
}

/// <summary>Per-OD TPA_Extensions for BFM — supports per-leg cabin preference and segment type.</summary>
public class BfmOdTpaExtensions
{
    /// <summary>
    /// Cabin preference override for this specific OD. Single object — overrides
    /// the global TravelPreferences.CabinPref for this leg only.
    /// </summary>
    [JsonPropertyName("CabinPref")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public BfmCabinPref? CabinPref { get; set; }

    /// <summary>
    /// Segment type — Code "O" signals this is an individual outbound/inbound leg
    /// with its own cabin preference (required for mixed-cabin roundtrips).
    /// </summary>
    [JsonPropertyName("SegmentType")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public BfmSegmentType? SegmentType { get; set; }
}

/// <summary>Segment type indicator for per-OD extensions.</summary>
public class BfmSegmentType
{
    [JsonPropertyName("Code")]
    public string Code { get; set; } = "O";
}
