namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Output;

public class ItineraryScorer : IItineraryScorer
{
    // Weights indexed by SearchPriority: [Value, Schedule, Duration, Comfort, Reliability]
    private static readonly Dictionary<SearchPriority, double[]> Weights = new()
    {
        [SearchPriority.Price]    = [0.50, 0.15, 0.15, 0.10, 0.10],
        [SearchPriority.Duration] = [0.15, 0.15, 0.50, 0.10, 0.10],
        [SearchPriority.Comfort]  = [0.15, 0.15, 0.15, 0.40, 0.15],
        [SearchPriority.Balanced] = [0.30, 0.20, 0.20, 0.15, 0.15],
    };

    public void ScoreAll(List<EnrichedItinerary> itineraries, SearchPriority priority, SearchRequest request)
    {
        if (itineraries.Count == 0) return;

        // Compute raw values for normalization
        var prices = itineraries.Select(i => (double)i.Pricing.TotalPrice).ToList();
        var durations = itineraries.Select(i => (double)i.TotalDurationMinutes).ToList();

        var minPrice = prices.Min();
        var maxPrice = prices.Max();
        var minDuration = durations.Min();
        var maxDuration = durations.Max();

        var weights = Weights[priority];

        foreach (var itin in itineraries)
        {
            var scores = itin.Scores;

            // Value: cheapest = 100, most expensive = 0 (inverse normalize)
            scores.ValueScore = NormalizeInverse((double)itin.Pricing.TotalPrice, minPrice, maxPrice);

            // Schedule: penalize red-eyes and early departures, reward time preference matches
            scores.ScheduleScore = ComputeScheduleScore(itin, request);

            // Duration: shortest = 100, longest = 0 (inverse normalize)
            scores.DurationScore = NormalizeInverse(itin.TotalDurationMinutes, minDuration, maxDuration);

            // Comfort: cabin class + stops + equipment
            scores.ComfortScore = ComputeComfortScore(itin);

            // Reliability: single carrier, direct, no codeshares
            scores.ReliabilityScore = ComputeReliabilityScore(itin);

            // Weighted overall
            scores.Overall = Math.Round(
                scores.ValueScore * weights[0] +
                scores.ScheduleScore * weights[1] +
                scores.DurationScore * weights[2] +
                scores.ComfortScore * weights[3] +
                scores.ReliabilityScore * weights[4],
                1);
        }

        // Rank by overall score descending
        var ranked = itineraries.OrderByDescending(i => i.Scores.Overall).ToList();
        for (var i = 0; i < ranked.Count; i++)
            ranked[i].Rank = i + 1;
    }

    private static double NormalizeInverse(double value, double min, double max)
    {
        if (Math.Abs(max - min) < 0.001) return 100;
        return Math.Round((1 - (value - min) / (max - min)) * 100, 1);
    }

    private static double ComputeScheduleScore(EnrichedItinerary itin, SearchRequest request)
    {
        var score = 100.0;

        for (var i = 0; i < itin.Segments.Count; i++)
        {
            var segment = itin.Segments[i];
            var depHour = segment.DepartureTime.Hour;

            // Penalize red-eye departures (22:00-05:00)
            if (depHour >= 22 || depHour < 5)
                score -= 25;
            // Penalize very early departures (05:00-07:00)
            else if (depHour < 7)
                score -= 10;
            // Slight penalty for very late evening (20:00-22:00)
            else if (depHour >= 20)
                score -= 5;

            // Time preference bonus/penalty — match by origin/destination, not index,
            // because SeparateOneWays itineraries only contain a subset of request segments
            var matchingReqSeg = request.Segments.FirstOrDefault(s =>
                string.Equals(s.Origin, segment.Origin, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(s.Destination, segment.Destination, StringComparison.OrdinalIgnoreCase));
            if (matchingReqSeg?.TimePreference is not null and not DepartureTimeWindow.Any)
            {
                if (IsWithinTimeWindow(depHour, matchingReqSeg.TimePreference.Value))
                    score += 15;
                else
                    score -= 10;
            }
        }

        return Math.Clamp(Math.Round(score, 1), 0, 100);
    }

    private static bool IsWithinTimeWindow(int hour, DepartureTimeWindow window) => window switch
    {
        DepartureTimeWindow.Morning => hour >= 6 && hour < 12,
        DepartureTimeWindow.Afternoon => hour >= 12 && hour < 18,
        DepartureTimeWindow.Evening => hour >= 18 && hour < 22,
        DepartureTimeWindow.RedEye => hour >= 22 || hour < 6,
        _ => true
    };

    private static double ComputeComfortScore(EnrichedItinerary itin)
    {
        var score = 50.0; // Start at midpoint

        // Cabin class bonus
        var cabins = itin.Segments.Select(s => s.Cabin).ToList();
        var bestCabin = cabins.Max();
        score += bestCabin switch
        {
            CabinClass.First => 30,
            CabinClass.Business => 25,
            CabinClass.PremiumEconomy => 15,
            _ => 0
        };

        // Nonstop bonus
        if (itin.Segments.All(s => s.Stops == 0))
            score += 15;
        else
        {
            // Penalize per stop
            var totalStops = itin.Segments.Sum(s => s.Stops);
            score -= totalStops * 8;
        }

        // Wide-body aircraft bonus
        var wideBodyCodes = new HashSet<string> { "777", "787", "747", "767", "330", "340", "350", "380", "788", "789", "77W", "77L", "773", "772", "359", "351" };
        if (itin.Segments.SelectMany(s => s.Legs).Any(l => wideBodyCodes.Contains(l.Equipment)))
            score += 5;

        return Math.Clamp(Math.Round(score, 1), 0, 100);
    }

    private static double ComputeReliabilityScore(EnrichedItinerary itin)
    {
        var score = 100.0;

        var allLegs = itin.Segments.SelectMany(s => s.Legs).ToList();

        // Penalize codeshares
        var codeshares = allLegs.Count(l => l.OperatingCarrier != l.MarketingCarrier);
        score -= codeshares * 10;

        // Penalize multiple carriers
        var distinctCarriers = allLegs.Select(l => l.MarketingCarrier).Distinct().Count();
        if (distinctCarriers > 1)
            score -= (distinctCarriers - 1) * 8;

        // Penalize tight connections
        foreach (var leg in allLegs)
        {
            if (leg.ConnectionTimeToNextMinutes is > 0 and < 60)
                score -= 15;
        }

        // Bonus for nonstop
        if (itin.Segments.All(s => s.Stops == 0))
            score += 5;

        return Math.Clamp(Math.Round(score, 1), 0, 100);
    }
}
