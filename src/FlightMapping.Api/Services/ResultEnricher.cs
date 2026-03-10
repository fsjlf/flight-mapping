namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Output;

public class ResultEnricher : IResultEnricher
{
    public void Enrich(EnrichedItinerary itinerary)
    {
        FormatDurations(itinerary);
        FormatConnectionTimes(itinerary);
        FormatPricing(itinerary);
        DetectHighlights(itinerary);
        DetectWarnings(itinerary);
    }

    private static void FormatDurations(EnrichedItinerary itinerary)
    {
        itinerary.TotalDurationFormatted = FormatMinutes(itinerary.TotalDurationMinutes);

        foreach (var segment in itinerary.Segments)
        {
            segment.DurationFormatted = FormatMinutes(segment.DurationMinutes);
        }
    }

    private static void FormatConnectionTimes(EnrichedItinerary itinerary)
    {
        foreach (var segment in itinerary.Segments)
        {
            if (segment.Legs.Count <= 1)
                continue;

            var totalConnection = segment.Legs
                .Where(l => l.ConnectionTimeToNextMinutes.HasValue)
                .Sum(l => l.ConnectionTimeToNextMinutes!.Value);

            if (totalConnection > 0)
            {
                segment.ConnectionTimeMinutes = totalConnection;
                segment.ConnectionTimeFormatted = FormatMinutes(totalConnection);
            }
        }
    }

    private static void FormatPricing(EnrichedItinerary itinerary)
    {
        var p = itinerary.Pricing;
        var symbol = p.CurrencyCode == "USD" ? "$" : p.CurrencyCode + " ";
        p.PriceFormatted = $"{symbol}{p.TotalPrice:N2}";
    }

    private static void DetectHighlights(EnrichedItinerary itinerary)
    {
        var highlights = itinerary.Highlights;

        // Nonstop throughout
        var allNonstop = itinerary.Segments.All(s => s.Stops == 0);
        if (allNonstop)
        {
            highlights.Add(itinerary.Segments.Count == 1 ? "Direct flight" : "Nonstop throughout");
        }

        // Same carrier throughout
        var carriers = itinerary.Segments
            .SelectMany(s => s.Legs)
            .Select(l => l.MarketingCarrier)
            .Distinct()
            .ToList();

        if (carriers.Count == 1)
            highlights.Add("Same carrier throughout");

        // Wide-body aircraft
        var wideBodyCodes = new HashSet<string> { "777", "787", "747", "767", "330", "340", "350", "380", "788", "789", "77W", "77L", "773", "772", "359", "351" };
        var hasWidebody = itinerary.Segments
            .SelectMany(s => s.Legs)
            .Any(l => wideBodyCodes.Contains(l.Equipment));

        if (hasWidebody)
            highlights.Add("Wide-body aircraft");

        // E-ticketable
        if (itinerary.ETicketable)
            highlights.Add("E-ticket");

        // Branded fare
        var brand = itinerary.Segments.FirstOrDefault(s => s.Brand != null)?.Brand;
        if (brand != null)
            highlights.Add($"Branded fare: {brand.Name}");

        // Refundable fare
        if (!itinerary.FarePolicy.NonRefundable)
            highlights.Add("Refundable");

        // Low seats available
        var minSeats = itinerary.Segments
            .SelectMany(s => s.Legs)
            .Where(l => l.SeatsAvailable > 0)
            .Select(l => l.SeatsAvailable)
            .DefaultIfEmpty(0)
            .Min();

        if (minSeats is > 0 and <= 4)
            highlights.Add($"Only {minSeats} seat{(minSeats == 1 ? "" : "s")} left");
    }

    private static void DetectWarnings(EnrichedItinerary itinerary)
    {
        var warnings = itinerary.Warnings;

        foreach (var segment in itinerary.Segments)
        {
            for (var i = 0; i < segment.Legs.Count; i++)
            {
                var leg = segment.Legs[i];

                // Long layover (>3 hours)
                if (leg.ConnectionTimeToNextMinutes.HasValue && leg.ConnectionTimeToNextMinutes.Value > 180)
                {
                    var formatted = FormatMinutes(leg.ConnectionTimeToNextMinutes.Value);
                    warnings.Add($"Long layover ({formatted}) in {leg.Destination}");
                }

                // Short connection (<60 minutes)
                if (leg.ConnectionTimeToNextMinutes.HasValue && leg.ConnectionTimeToNextMinutes.Value < 60 && leg.ConnectionTimeToNextMinutes.Value > 0)
                {
                    warnings.Add($"Short connection ({leg.ConnectionTimeToNextMinutes.Value}m) in {leg.Destination}");
                }

                // Red-eye detection (depart 22:00-05:00)
                var depHour = leg.DepartureTime.Hour;
                if (depHour >= 22 || depHour < 5)
                {
                    warnings.Add($"Red-eye flight ({leg.Origin}-{leg.Destination})");
                }

                // Overnight connection
                if (leg.ConnectionTimeToNextMinutes.HasValue && leg.ConnectionTimeToNextMinutes.Value > 360)
                {
                    var nextLeg = i + 1 < segment.Legs.Count ? segment.Legs[i + 1] : null;
                    if (nextLeg != null && nextLeg.DepartureTime.Date > leg.ArrivalTime.Date)
                    {
                        warnings.Add($"Overnight connection in {leg.Destination}");
                    }
                }

                // Codeshare
                if (leg.OperatingCarrier != leg.MarketingCarrier)
                {
                    warnings.Add($"Codeshare: operated by {leg.OperatingCarrier}");
                }

                // Technical stop (schedule has stopCount > 0 but it's a single leg)
                if (leg.StopCount > 0)
                {
                    warnings.Add($"Technical stop on {leg.FlightNumber} ({leg.Origin}-{leg.Destination})");
                }
            }
        }

        // Multiple airlines
        var distinctCarriers = itinerary.Segments
            .SelectMany(s => s.Legs)
            .Select(l => l.MarketingCarrier)
            .Distinct()
            .Count();

        if (distinctCarriers > 1)
            warnings.Add("Multiple airlines");

        // Non-refundable
        if (itinerary.FarePolicy.NonRefundable)
            warnings.Add("Non-refundable fare");

        // Deduplicate
        var deduplicated = warnings.Distinct().ToList();
        warnings.Clear();
        warnings.AddRange(deduplicated);
    }

    private static string FormatMinutes(int totalMinutes)
    {
        var hours = totalMinutes / 60;
        var minutes = totalMinutes % 60;
        return hours > 0 ? $"{hours}h {minutes}m" : $"{minutes}m";
    }
}
