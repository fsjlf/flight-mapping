namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;

public interface IRouteExpander
{
    /// <summary>
    /// Expands multi-airport segments into concrete single-airport route variants.
    /// Each variant can be searched through the existing pipeline unchanged.
    /// Returns a single variant for standard single-airport searches (zero overhead).
    /// </summary>
    List<RouteVariant> Expand(SearchRequest request);
}

public class RouteVariant
{
    /// <summary>Single-airport SearchRequest ready for the existing pipeline.</summary>
    public SearchRequest Request { get; set; } = null!;

    /// <summary>Human-readable label, e.g. "JFK→LHR / LHR→JFK"</summary>
    public string RouteLabel { get; set; } = "";
}
