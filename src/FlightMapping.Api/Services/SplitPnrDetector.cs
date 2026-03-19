namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;
using FlightMapping.Api.Models.Search.Output;

public class SplitPnrDetector : ISplitPnrDetector
{
    public List<SplitPnrDetection> Detect(
        List<EnrichedItinerary> groupItineraries,
        List<EnrichedItinerary> singlePaxItineraries,
        int totalPassengers)
    {
        var detections = new List<SplitPnrDetection>();

        // Build lookup of single-pax itineraries by flight fingerprint
        var singleByFlight = BuildFlightLookup(singlePaxItineraries);

        foreach (var groupItin in groupItineraries)
        {
            var flightKey = BuildFlightKey(groupItin);
            if (!singleByFlight.TryGetValue(flightKey, out var singleItin))
                continue;

            var groupPrice = groupItin.Pricing.PricePerAdult;
            var singlePrice = singleItin.Pricing.PricePerAdult;

            if (singlePrice >= groupPrice)
                continue;

            var delta = groupPrice - singlePrice;
            var minSavings = delta; // at least 1 seat cheaper
            var maxSavings = delta * (totalPassengers - 1); // up to N-1 seats cheaper

            var totalGroupCost = groupPrice * totalPassengers;
            var minPercent = totalGroupCost > 0 ? (double)(minSavings / totalGroupCost) * 100 : 0;
            var maxPercent = totalGroupCost > 0 ? (double)(maxSavings / totalGroupCost) * 100 : 0;

            // Determine badge level
            var savingsPerPerson = maxSavings / totalPassengers;
            string badge;
            if (savingsPerPerson >= 100 || maxPercent >= 10)
                badge = "green";
            else if (savingsPerPerson >= 50 || maxPercent >= 5)
                badge = "yellow";
            else
                badge = "none";

            // Suppress trivial savings
            if (savingsPerPerson < 50 && maxPercent < 3)
                continue;

            var singleRbd = singleItin.Segments.FirstOrDefault()?.BookingClass ?? "?";
            var groupRbd = groupItin.Segments.FirstOrDefault()?.BookingClass ?? "?";

            detections.Add(new SplitPnrDetection
            {
                OpportunityDetected = true,
                FlightKey = flightKey,
                SinglePaxPrice = singlePrice,
                SinglePaxRbd = singleRbd,
                GroupPricePerPerson = groupPrice,
                GroupRbd = groupRbd,
                DeltaPerPerson = delta,
                TotalPassengers = totalPassengers,
                MinEstimatedSavings = minSavings,
                MaxEstimatedSavings = maxSavings,
                SavingsBadge = badge,
            });
        }

        return detections.OrderByDescending(d => d.MaxEstimatedSavings).ToList();
    }

    /// <summary>
    /// Build a flight fingerprint key from carrier + flight numbers + route.
    /// </summary>
    private static string BuildFlightKey(EnrichedItinerary itin)
    {
        return string.Join("|", itin.Segments.Select(s =>
            $"{s.MarketingCarrier}{s.FlightNumber}_{s.Origin}{s.Destination}_{s.DepartureTime:yyyyMMdd}"));
    }

    private static Dictionary<string, EnrichedItinerary> BuildFlightLookup(List<EnrichedItinerary> itineraries)
    {
        var lookup = new Dictionary<string, EnrichedItinerary>();
        foreach (var itin in itineraries)
        {
            var key = BuildFlightKey(itin);
            // Keep cheapest per flight
            if (!lookup.ContainsKey(key) || itin.Pricing.PricePerAdult < lookup[key].Pricing.PricePerAdult)
                lookup[key] = itin;
        }
        return lookup;
    }
}
