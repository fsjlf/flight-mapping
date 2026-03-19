namespace FlightMapping.Api.Models.Search.Input;

using System.Text.Json;
using System.Text.Json.Serialization;
using FlightMapping.Api.Models.Enums;

[JsonConverter(typeof(SegmentInputConverter))]
public class SegmentInput
{
    /// <summary>One or more origin airport codes (e.g. ["JFK","EWR"] for multi-airport search)</summary>
    public List<string> Origins { get; set; } = new();

    /// <summary>One or more destination airport codes</summary>
    public List<string> Destinations { get; set; } = new();

    public DateOnly DepartureDate { get; set; }
    public DepartureTimeWindow? TimePreference { get; set; }
    public CabinClass? CabinOverride { get; set; }

    // ── Convenience accessors for single-airport pipeline (used after RouteExpander) ──

    /// <summary>First origin code. Used by BfmRequestBuilder, TripClassifier, etc. after expansion.</summary>
    [JsonIgnore]
    public string Origin => Origins.Count > 0 ? Origins[0] : string.Empty;

    /// <summary>First destination code.</summary>
    [JsonIgnore]
    public string Destination => Destinations.Count > 0 ? Destinations[0] : string.Empty;
}

/// <summary>
/// Accepts both old format ("origin":"JFK") and new format ("origins":["JFK","EWR"]).
/// Normalizes everything to Origins/Destinations lists.
/// </summary>
public class SegmentInputConverter : JsonConverter<SegmentInput>
{
    public override SegmentInput Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var seg = new SegmentInput();
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        // Origins: accept "origin" (string) or "origins" (array)
        if (root.TryGetProperty("origins", out var originsArr) && originsArr.ValueKind == JsonValueKind.Array)
        {
            seg.Origins = originsArr.EnumerateArray()
                .Select(e => e.GetString()?.Trim().ToUpperInvariant() ?? "")
                .Where(s => s.Length > 0)
                .Distinct()
                .Take(5)
                .ToList();
        }
        else if (root.TryGetProperty("origin", out var originStr) && originStr.ValueKind == JsonValueKind.String)
        {
            var val = originStr.GetString()?.Trim().ToUpperInvariant() ?? "";
            if (val.Length > 0) seg.Origins.Add(val);
        }

        // Destinations: accept "destination" (string) or "destinations" (array)
        if (root.TryGetProperty("destinations", out var destsArr) && destsArr.ValueKind == JsonValueKind.Array)
        {
            seg.Destinations = destsArr.EnumerateArray()
                .Select(e => e.GetString()?.Trim().ToUpperInvariant() ?? "")
                .Where(s => s.Length > 0)
                .Distinct()
                .Take(5)
                .ToList();
        }
        else if (root.TryGetProperty("destination", out var destStr) && destStr.ValueKind == JsonValueKind.String)
        {
            var val = destStr.GetString()?.Trim().ToUpperInvariant() ?? "";
            if (val.Length > 0) seg.Destinations.Add(val);
        }

        // DepartureDate
        if (root.TryGetProperty("departureDate", out var dateEl))
        {
            var dateStr = dateEl.GetString() ?? "";
            if (DateOnly.TryParse(dateStr, out var d)) seg.DepartureDate = d;
        }

        // TimePreference
        if (root.TryGetProperty("timePreference", out var timeEl) && timeEl.ValueKind == JsonValueKind.String)
        {
            if (Enum.TryParse<DepartureTimeWindow>(timeEl.GetString(), true, out var tw))
                seg.TimePreference = tw;
        }

        // CabinOverride
        if (root.TryGetProperty("cabinOverride", out var cabinEl) && cabinEl.ValueKind == JsonValueKind.String)
        {
            if (Enum.TryParse<CabinClass>(cabinEl.GetString(), true, out var cc))
                seg.CabinOverride = cc;
        }

        return seg;
    }

    public override void Write(Utf8JsonWriter writer, SegmentInput value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();

        writer.WritePropertyName("origins");
        writer.WriteStartArray();
        foreach (var o in value.Origins) writer.WriteStringValue(o);
        writer.WriteEndArray();

        writer.WritePropertyName("destinations");
        writer.WriteStartArray();
        foreach (var d in value.Destinations) writer.WriteStringValue(d);
        writer.WriteEndArray();

        writer.WriteString("departureDate", value.DepartureDate.ToString("yyyy-MM-dd"));

        if (value.TimePreference.HasValue)
            writer.WriteString("timePreference", value.TimePreference.Value.ToString());
        if (value.CabinOverride.HasValue)
            writer.WriteString("cabinOverride", value.CabinOverride.Value.ToString());

        writer.WriteEndObject();
    }
}
