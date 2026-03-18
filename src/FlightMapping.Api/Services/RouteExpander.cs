namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;

public class RouteExpander : IRouteExpander
{
    private const int MaxRouteCombinations = 20;

    public List<RouteVariant> Expand(SearchRequest request)
    {
        // Fast path: if every segment has exactly 1 origin and 1 destination,
        // return a single variant with zero overhead.
        var isSimple = request.Segments.All(s => s.Origins.Count <= 1 && s.Destinations.Count <= 1);
        if (isSimple)
        {
            return new List<RouteVariant>
            {
                new()
                {
                    Request = request,
                    RouteLabel = string.Join(" / ", request.Segments.Select(s => $"{s.Origin}→{s.Destination}"))
                }
            };
        }

        // Build per-segment airport pair options
        var segmentPairOptions = request.Segments.Select(seg =>
        {
            var origins = seg.Origins.Count > 0 ? seg.Origins : new List<string> { "" };
            var dests = seg.Destinations.Count > 0 ? seg.Destinations : new List<string> { "" };
            return origins
                .SelectMany(o => dests.Select(d => (Origin: o, Destination: d)))
                .ToList();
        }).ToList();

        // Cartesian product across all segments
        var combos = CartesianProduct(segmentPairOptions);

        // Cap at max
        var capped = combos.Take(MaxRouteCombinations).ToList();

        return capped.Select(combo =>
        {
            var variant = new SearchRequest
            {
                Segments = combo.Select((pair, i) =>
                {
                    var original = request.Segments[i];
                    return new SegmentInput
                    {
                        Origins = new List<string> { pair.Origin },
                        Destinations = new List<string> { pair.Destination },
                        DepartureDate = original.DepartureDate,
                        TimePreference = original.TimePreference,
                        CabinOverride = original.CabinOverride,
                    };
                }).ToList(),
                Passengers = request.Passengers,
                Preferences = request.Preferences,
            };

            var label = string.Join(" / ", combo.Select(p => $"{p.Origin}→{p.Destination}"));

            return new RouteVariant
            {
                Request = variant,
                RouteLabel = label,
            };
        }).ToList();
    }

    /// <summary>
    /// Compute the Cartesian product of a list of lists.
    /// E.g., [[A,B],[X,Y]] → [[A,X],[A,Y],[B,X],[B,Y]]
    /// </summary>
    private static IEnumerable<List<(string Origin, string Destination)>> CartesianProduct(
        List<List<(string Origin, string Destination)>> segmentOptions)
    {
        IEnumerable<List<(string, string)>> result = new List<List<(string, string)>> { new() };

        foreach (var segment in segmentOptions)
        {
            result = result.SelectMany(
                prev => segment.Select(pair =>
                {
                    var next = new List<(string, string)>(prev) { pair };
                    return next;
                }));
        }

        return result;
    }
}
