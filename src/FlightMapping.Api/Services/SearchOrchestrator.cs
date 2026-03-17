namespace FlightMapping.Api.Services;

using System.Diagnostics;
using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Sabre.Response;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;
using FlightMapping.Api.Models.Search.Output;
using FlightMapping.Api.Models.SplitPnr;

public class SearchOrchestrator : ISearchOrchestrator
{
    private readonly ITripClassifier _tripClassifier;
    private readonly IStrategyGenerator _strategyGenerator;
    private readonly IBfmRequestBuilder _requestBuilder;
    private readonly ISabreClient _sabreClient;
    private readonly IBfmResponseParser _responseParser;
    private readonly IResultEnricher _resultEnricher;
    private readonly IItineraryScorer _scorer;
    private readonly ILogger<SearchOrchestrator> _logger;

    public SearchOrchestrator(
        ITripClassifier tripClassifier,
        IStrategyGenerator strategyGenerator,
        IBfmRequestBuilder requestBuilder,
        ISabreClient sabreClient,
        IBfmResponseParser responseParser,
        IResultEnricher resultEnricher,
        IItineraryScorer scorer,
        ILogger<SearchOrchestrator> logger)
    {
        _tripClassifier = tripClassifier;
        _strategyGenerator = strategyGenerator;
        _requestBuilder = requestBuilder;
        _sabreClient = sabreClient;
        _responseParser = responseParser;
        _resultEnricher = resultEnricher;
        _scorer = scorer;
        _logger = logger;
    }

    public async Task<SearchResponse> SearchAsync(SearchRequest request, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var searchId = Guid.NewGuid().ToString("N")[..12];
        var totalSeated = request.Passengers.TotalSeated;

        _logger.LogInformation("Starting search {SearchId} with {SegmentCount} segments", searchId, request.Segments.Count);

        // 1. Classify trip
        var classification = _tripClassifier.Classify(request.Segments);
        _logger.LogInformation("Trip classified as {TripType} with {StrategyCount} strategies",
            classification.Type, classification.RecommendedStrategies.Count);

        // 2. Generate execution plan
        var plan = _strategyGenerator.GeneratePlan(request, classification);
        _logger.LogInformation("Execution plan: {CallCount} API calls in {WaveCount} waves",
            plan.TotalApiCalls, plan.ExecutionWaves);

        // 2b. If multi-pax, fire a 1-pax probe search in parallel for split PNR detection.
        // This adds no latency since it runs concurrently with the main search waves.
        Task<List<EnrichedItinerary>>? splitProbeTask = null;
        if (totalSeated >= 2)
        {
            splitProbeTask = RunSplitPnrProbeAsync(request, classification, cancellationToken);
        }

        // 3. Execute strategies in waves
        var allItineraries = new List<EnrichedItinerary>();
        var strategyResults = new List<StrategyResult>();
        var sabreMessages = new List<string>();

        var allCalls = plan.Strategies
            .SelectMany(s => s.ApiCalls.Select(c => (Strategy: s, Call: c)))
            .ToList();

        var waves = allCalls.GroupBy(x => x.Call.Wave).OrderBy(g => g.Key);

        foreach (var wave in waves)
        {
            _logger.LogInformation("Executing wave {WaveNumber} with {CallCount} parallel calls",
                wave.Key, wave.Count());

            var tasks = wave.Select(x => ExecuteApiCall(x.Strategy, x.Call, request, cancellationToken));
            var results = await Task.WhenAll(tasks);

            foreach (var (itineraries, stratResult, messages) in results)
            {
                allItineraries.AddRange(itineraries);
                strategyResults.Add(stratResult);
                sabreMessages.AddRange(messages);
            }
        }

        _logger.LogInformation("Collected {Count} raw itineraries across all strategies", allItineraries.Count);

        // 3b. Drop itineraries with zero/missing pricing (broken fare data)
        allItineraries.RemoveAll(i => i.Pricing.TotalPrice <= 0 || string.IsNullOrEmpty(i.Pricing.CurrencyCode));

        // 4. Deduplicate: same physical flight + same fare product = duplicate.
        //    Keep the cheapest per (flight fingerprint + validating carrier + brand + booking class).
        var deduplicated = allItineraries
            .GroupBy(i => BuildDedupKey(i))
            .Select(g => g.OrderBy(i => i.Pricing.PricePerAdult).First())
            .ToList();

        _logger.LogInformation("After deduplication: {Count} itineraries", deduplicated.Count);

        // 5. Enrich
        foreach (var itin in deduplicated)
            _resultEnricher.Enrich(itin);

        // 6. Score and rank
        var priority = request.Preferences?.Priority ?? SearchPriority.Balanced;
        _scorer.ScoreAll(deduplicated, priority, request);

        // 7. Cap results while ensuring every strategy type is represented.
        //    SingleTicket / Hybrid results are far fewer than SeparateOneWays,
        //    so include all of them and fill the rest with top-ranked OWs.
        const int maxResults = 1500;
        var nonOws = deduplicated
            .Where(i => i.StrategyType != TicketingStrategyType.SeparateOneWays)
            .OrderBy(i => i.Rank)
            .ToList();
        var owSlots = Math.Max(0, maxResults - nonOws.Count);
        var ows = deduplicated
            .Where(i => i.StrategyType == TicketingStrategyType.SeparateOneWays)
            .OrderBy(i => i.Rank)
            .Take(owSlots)
            .ToList();
        var ranked = nonOws.Concat(ows).OrderBy(i => i.Rank).ToList();

        if (deduplicated.Count > maxResults)
            _logger.LogInformation("Capped results from {Total} to {Max}", deduplicated.Count, maxResults);

        // 8. Split PNR detection with incremental probing
        List<SplitPnrDetection>? splitOpportunities = null;
        if (splitProbeTask != null)
        {
            try
            {
                var probeResults = await splitProbeTask;
                var initialDetections = DetectSplitOpportunities(ranked, probeResults, totalSeated);

                if (initialDetections.Count > 0 && totalSeated > 2)
                {
                    // Incremental probing: fire 2, 3, ... (N-1) pax searches in parallel
                    // to find exact auth cap breakpoints
                    _logger.LogInformation(
                        "Found {Count} initial split opportunities, probing 2..{Max} pax for breakpoints",
                        initialDetections.Count, totalSeated - 1);

                    var probeTasks = new Dictionary<int, Task<List<EnrichedItinerary>>>();
                    for (int paxCount = 2; paxCount < totalSeated; paxCount++)
                    {
                        probeTasks[paxCount] = RunSplitPnrProbeAsync(request, classification, cancellationToken, paxCount);
                    }
                    await Task.WhenAll(probeTasks.Values);

                    // Build pax→(flightCabinKey→cheapestPrice) lookup for each probe count
                    // Include the 1-pax results we already have
                    var allProbesByPax = new Dictionary<int, Dictionary<string, (decimal Price, string Rbd)>>
                    {
                        [1] = BuildProbePriceLookup(probeResults)
                    };
                    foreach (var (paxCount, task) in probeTasks)
                    {
                        try
                        {
                            allProbesByPax[paxCount] = BuildProbePriceLookup(await task);
                        }
                        catch { /* skip failed probes */ }
                    }

                    splitOpportunities = DetectSplitOpportunitiesWithBreakpoints(
                        ranked, allProbesByPax, totalSeated);
                }
                else
                {
                    splitOpportunities = initialDetections;
                }

                if (splitOpportunities.Count > 0)
                    _logger.LogInformation("Detected {Count} split PNR opportunities with breakpoints", splitOpportunities.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Split PNR probe failed — continuing without detections");
            }
        }

        stopwatch.Stop();

        return new SearchResponse
        {
            SearchId = searchId,
            Classification = classification,
            Itineraries = ranked,
            SplitPnrOpportunities = splitOpportunities,
            Metadata = new SearchMetadata
            {
                TotalResults = ranked.Count,
                StrategiesExecuted = plan.Strategies.Count,
                ApiCallsMade = plan.TotalApiCalls,
                SearchDurationMs = stopwatch.ElapsedMilliseconds,
                StrategyResults = strategyResults,
                SabreMessages = sabreMessages.Distinct().ToList(),
            }
        };
    }

    private async Task<(List<EnrichedItinerary> Itineraries, StrategyResult Result, List<string> Messages)> ExecuteApiCall(
        SearchStrategy strategy,
        StrategyApiCall apiCall,
        SearchRequest request,
        CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        var stratResult = new StrategyResult
        {
            StrategyId = strategy.Id,
            Type = strategy.Type.ToString(),
        };

        try
        {
            // Build BFM request
            var bfmRequest = _requestBuilder.Build(apiCall, request);

            // Log cabin preferences for debugging multi-class searches
            var cabinPrefs = bfmRequest.SearchRq.TravelPreferences.CabinPref;
            var perOdInfo = bfmRequest.SearchRq.OriginDestinationInformation
                .Select(od => $"OD{od.Rph}={od.TpaExtensions?.CabinPref?.Cabin ?? "global"}")
                .ToList();
            _logger.LogInformation(
                "BFM call {CallId} — global CabinPref: [{GlobalCabins}] | per-OD: [{PerOd}] | segments [{SegIndices}]",
                apiCall.CallId,
                string.Join(", ", cabinPrefs.Select(c => c.Cabin)),
                string.Join(", ", perOdInfo),
                string.Join(", ", apiCall.SegmentIndices));

            // Execute
            var response = await _sabreClient.SearchFlightsAsync(bfmRequest, cancellationToken);

            sw.Stop();
            stratResult.DurationMs = sw.ElapsedMilliseconds;

            if (response == null)
            {
                stratResult.Success = false;
                stratResult.Error = "Null response from Sabre BFM";
                _logger.LogWarning("Strategy {StrategyId} call {CallId} returned null", strategy.Id, apiCall.CallId);
                return (new List<EnrichedItinerary>(), stratResult, new List<string>());
            }

            // Capture Sabre messages
            var messages = response.GroupedItineraryResponse.Messages?
                .Select(m => $"[{m.Severity}] {m.Text}")
                .ToList() ?? new List<string>();

            // Parse
            var itineraries = _responseParser.Parse(response, apiCall, strategy);

            stratResult.Success = true;
            stratResult.ResultCount = itineraries.Count;

            // Log cabin class distribution for debugging multi-class
            var cabinDist = itineraries
                .SelectMany(i => i.Segments.Select(s => s.Cabin.ToString()))
                .GroupBy(c => c)
                .Select(g => $"{g.Key}={g.Count()}")
                .ToList();

            // Also log mixed-cabin pairs (e.g. "Business→Economy=15, Business→Business=20")
            var cabinPairs = itineraries
                .Where(i => i.Segments.Count > 1)
                .Select(i => string.Join("→", i.Segments.Select(s => s.Cabin.ToString())))
                .GroupBy(p => p)
                .Select(g => $"{g.Key}={g.Count()}")
                .ToList();

            _logger.LogInformation(
                "Strategy {StrategyId} call {CallId}: {Count} itineraries in {Ms}ms — cabins: [{CabinDist}] — pairs: [{CabinPairs}]",
                strategy.Id, apiCall.CallId, itineraries.Count, sw.ElapsedMilliseconds,
                string.Join(", ", cabinDist),
                cabinPairs.Count > 0 ? string.Join(", ", cabinPairs) : "n/a (one-way)");

            return (itineraries, stratResult, messages);
        }
        catch (Exception ex)
        {
            sw.Stop();
            stratResult.Success = false;
            stratResult.Error = ex.Message;
            stratResult.DurationMs = sw.ElapsedMilliseconds;

            _logger.LogError(ex, "Strategy {StrategyId} call {CallId} failed", strategy.Id, apiCall.CallId);
            return (new List<EnrichedItinerary>(), stratResult, new List<string>());
        }
    }

    /// <summary>
    /// Build a dedup key that preserves different branded fares for the same physical flight.
    /// Key = flight fingerprint + validating carrier + brand name + booking class per segment.
    /// </summary>
    private static string BuildDedupKey(EnrichedItinerary itin)
    {
        // Flight identity (from the ID's fingerprint hash)
        var fingerprint = itin.Id.Split('-').LastOrDefault() ?? itin.Id;

        // Fare identity
        var fareKey = string.Join("|", itin.Segments.Select(s =>
            $"{s.BookingClass}:{s.Cabin}:{s.Brand?.Name ?? ""}"));

        return $"{fingerprint}|{itin.ValidatingCarrier}|{fareKey}";
    }

    /// <summary>
    /// Fire a probe search with a specific passenger count.
    /// Default is 1 adult for initial detection.
    /// </summary>
    private async Task<List<EnrichedItinerary>> RunSplitPnrProbeAsync(
        SearchRequest originalRequest,
        TripClassification classification,
        CancellationToken cancellationToken,
        int adultCount = 1)
    {
        var probeRequest = new SearchRequest
        {
            Segments = originalRequest.Segments,
            Passengers = new PassengerConfig { Adults = adultCount },
            Preferences = originalRequest.Preferences
        };

        var probePlan = _strategyGenerator.GeneratePlan(probeRequest, classification);

        // Only run the first strategy (cheapest route) to keep it fast
        var firstStrategy = probePlan.Strategies.FirstOrDefault();
        if (firstStrategy == null) return new List<EnrichedItinerary>();

        var firstCall = firstStrategy.ApiCalls.FirstOrDefault();
        if (firstCall == null) return new List<EnrichedItinerary>();

        _logger.LogInformation("Split PNR probe: firing {PaxCount}-pax search for comparison", adultCount);

        try
        {
            var (itineraries, _, _) = await ExecuteApiCall(firstStrategy, firstCall, probeRequest, cancellationToken);

            // Drop broken pricing
            itineraries.RemoveAll(i => i.Pricing.TotalPrice <= 0);

            _logger.LogInformation("Split PNR probe: got {Count} itineraries for {PaxCount}-pax", itineraries.Count, adultCount);
            return itineraries;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Split PNR 1-pax probe failed");
            return new List<EnrichedItinerary>();
        }
    }

    /// <summary>
    /// Compare N-pax search results with 1-pax probe results.
    /// For each flight+cabin where the CHEAPEST 1-pax fare is cheaper than the CHEAPEST N-pax fare,
    /// emit a split PNR detection. This avoids false positives from comparing cheap probes
    /// against expensive N-pax variants when the same cheap fare is already available for N pax.
    /// </summary>
    private static List<SplitPnrDetection> DetectSplitOpportunities(
        List<EnrichedItinerary> mainResults,
        List<EnrichedItinerary> probeResults,
        int totalPax)
    {
        if (probeResults.Count == 0) return new List<SplitPnrDetection>();

        // Build lookup: flightCabinKey → cheapest 1-pax price
        var probePrices = new Dictionary<string, (decimal Price, string Rbd, string BrandName)>();
        foreach (var itin in probeResults)
        {
            var key = BuildFlightCabinKey(itin);
            var price = itin.Pricing.PricePerAdult;
            if (!probePrices.TryGetValue(key, out var existing) || price < existing.Price)
            {
                probePrices[key] = (price, itin.Segments[0].BookingClass, itin.Segments[0].Brand?.Name ?? "");
            }
        }

        // Build lookup: flightCabinKey → cheapest N-pax price
        // This is critical: we compare 1-pax against the CHEAPEST N-pax fare, not any random variant
        var mainCheapest = new Dictionary<string, (decimal Price, string Rbd, EnrichedItinerary Itin)>();
        foreach (var itin in mainResults)
        {
            var key = BuildFlightCabinKey(itin);
            var price = itin.Pricing.PricePerAdult;
            if (!mainCheapest.TryGetValue(key, out var existing) || price < existing.Price)
            {
                mainCheapest[key] = (price, itin.Segments[0].BookingClass, itin);
            }
        }

        // Compare: only flag when 1-pax cheapest < N-pax cheapest for same flight+cabin
        var detections = new Dictionary<string, SplitPnrDetection>();
        foreach (var (cabinKey, main) in mainCheapest)
        {
            if (!probePrices.TryGetValue(cabinKey, out var probe)) continue;

            var delta = main.Price - probe.Price;
            if (delta <= 0) continue; // 1-pax isn't cheaper — no opportunity

            var flightKey = BuildFlightKey(main.Itin);

            // Conservative estimate: at least 1 passenger can get cheap fare, up to half the group
            var minCheapSeats = 1;
            var maxCheapSeats = Math.Max(1, totalPax / 2);
            var minSavings = delta * minCheapSeats;
            var maxSavings = delta * maxCheapSeats;
            var totalGroupCost = main.Price * totalPax;
            var maxPct = totalGroupCost > 0 ? (maxSavings / totalGroupCost) * 100 : 0;

            if (minSavings < 20 && maxPct < 2) continue;

            var badge = maxPct >= 8 ? "green" : maxPct >= 3 ? "yellow" : "none";
            if (badge == "none") continue;

            // Dedup: keep biggest savings per physical flight
            if (detections.TryGetValue(flightKey, out var existing) && existing.MaxEstimatedSavings >= maxSavings)
                continue;

            detections[flightKey] = new SplitPnrDetection
            {
                OpportunityDetected = true,
                FlightKey = flightKey,
                SinglePaxPrice = probe.Price,
                SinglePaxRbd = probe.Rbd,
                GroupPricePerPerson = main.Price,
                GroupRbd = main.Rbd,
                DeltaPerPerson = delta,
                TotalPassengers = totalPax,
                MinEstimatedSavings = minSavings,
                MaxEstimatedSavings = maxSavings,
                SavingsBadge = badge,
            };
        }

        return detections.Values
            .OrderByDescending(d => d.MaxEstimatedSavings)
            .ToList();
    }

    /// <summary>Build a lookup of flightCabinKey → cheapest price for a set of probe results.</summary>
    private static Dictionary<string, (decimal Price, string Rbd)> BuildProbePriceLookup(
        List<EnrichedItinerary> probeResults)
    {
        var lookup = new Dictionary<string, (decimal Price, string Rbd)>();
        foreach (var itin in probeResults)
        {
            var key = BuildFlightCabinKey(itin);
            var price = itin.Pricing.PricePerAdult;
            if (!lookup.TryGetValue(key, out var existing) || price < existing.Price)
            {
                lookup[key] = (price, itin.Segments[0].BookingClass);
            }
        }
        return lookup;
    }

    /// <summary>
    /// Detect split PNR opportunities using incremental probe data to find exact breakpoints.
    /// Walks from 1 pax upward, tracking every price transition to build multi-tier allocations.
    /// Example: for 5 pax, might produce 3×P + 1×Z + 1×C if auth caps are 3, 4, 5.
    /// </summary>
    private static List<SplitPnrDetection> DetectSplitOpportunitiesWithBreakpoints(
        List<EnrichedItinerary> mainResults,
        Dictionary<int, Dictionary<string, (decimal Price, string Rbd)>> probesByPax,
        int totalPax)
    {
        if (!probesByPax.ContainsKey(1)) return new List<SplitPnrDetection>();

        // Find cheapest N-pax price per flight+cabin (avoid false positives)
        var mainCheapest = new Dictionary<string, (decimal Price, string Rbd, EnrichedItinerary Itin)>();
        foreach (var itin in mainResults)
        {
            var key = BuildFlightCabinKey(itin);
            var price = itin.Pricing.PricePerAdult;
            if (!mainCheapest.TryGetValue(key, out var existing) || price < existing.Price)
            {
                mainCheapest[key] = (price, itin.Segments[0].BookingClass, itin);
            }
        }

        var detections = new Dictionary<string, SplitPnrDetection>();

        foreach (var (cabinKey, main) in mainCheapest)
        {
            var flightKey = BuildFlightKey(main.Itin);
            var groupPrice = main.Price;

            if (!probesByPax[1].TryGetValue(cabinKey, out var probe1)) continue;
            if (probe1.Price >= groupPrice) continue;

            // Walk from 1 to N-1, tracking every price transition → multi-tier allocation
            var tiers = new List<SplitAllocationTier>();
            var currentPrice = probe1.Price;
            var currentRbd = probe1.Rbd;
            var currentCount = 1;

            for (int pax = 2; pax <= totalPax; pax++)
            {
                decimal thisPrice;
                string thisRbd;

                if (pax == totalPax)
                {
                    // The N-pax price is the group price from the main search
                    thisPrice = groupPrice;
                    thisRbd = main.Rbd;
                }
                else if (probesByPax.TryGetValue(pax, out var probeN) && probeN.TryGetValue(cabinKey, out var probePrice))
                {
                    thisPrice = probePrice.Price;
                    thisRbd = probePrice.Rbd;
                }
                else
                {
                    // No probe data for this count — assume price jumped to group price
                    thisPrice = groupPrice;
                    thisRbd = main.Rbd;
                }

                if (Math.Abs(thisPrice - currentPrice) < 5m)
                {
                    // Same price tier — increment count
                    currentCount++;
                }
                else
                {
                    // Price changed — close current tier and start new one
                    tiers.Add(new SplitAllocationTier
                    {
                        Rbd = currentRbd,
                        Count = currentCount,
                        PricePerPerson = currentPrice,
                    });
                    currentPrice = thisPrice;
                    currentRbd = thisRbd;
                    currentCount = 1;
                }
            }
            // Close the last tier
            tiers.Add(new SplitAllocationTier
            {
                Rbd = currentRbd,
                Count = currentCount,
                PricePerPerson = currentPrice,
            });

            // If only one tier, no split opportunity
            if (tiers.Count <= 1) continue;

            var splitTotal = tiers.Sum(t => t.Subtotal);
            var totalGroupCost = groupPrice * totalPax;
            var savings = totalGroupCost - splitTotal;
            var pct = totalGroupCost > 0 ? (savings / totalGroupCost) * 100 : 0;

            if (savings < 20) continue;
            var badge = pct >= 8 ? "green" : pct >= 3 ? "yellow" : "none";
            if (badge == "none") continue;

            // Dedup: keep biggest savings per physical flight
            if (detections.TryGetValue(flightKey, out var existing) && existing.MaxEstimatedSavings >= savings)
                continue;

            detections[flightKey] = new SplitPnrDetection
            {
                OpportunityDetected = true,
                FlightKey = flightKey,
                SinglePaxPrice = tiers[0].PricePerPerson,
                SinglePaxRbd = tiers[0].Rbd,
                GroupPricePerPerson = groupPrice,
                GroupRbd = main.Rbd,
                DeltaPerPerson = groupPrice - tiers[0].PricePerPerson,
                TotalPassengers = totalPax,
                MinEstimatedSavings = savings,
                MaxEstimatedSavings = savings,
                SavingsBadge = badge,
                CheapSeatsAvailable = tiers[0].Count,
                Tiers = tiers,
            };
        }

        return detections.Values
            .OrderByDescending(d => d.MaxEstimatedSavings)
            .ToList();
    }

    /// <summary>Flight fingerprint + cabin for matching 1-pax vs N-pax within same cabin class.</summary>
    private static string BuildFlightCabinKey(EnrichedItinerary itin)
    {
        var flights = BuildFlightKey(itin);
        var cabin = string.Join("+", itin.Segments.Select(s => s.Cabin.ToString()));
        return $"{flights}#{cabin}";
    }

    /// <summary>
    /// Flight fingerprint matching the frontend format from itineraryGrouping2.ts:
    /// operatingCarrier + operatingFlightNumber + "-" + ISO departureTime, joined by "|"
    /// Must match JSON serialization format: "2026-03-21T17:59:00"
    /// </summary>
    private static string BuildFlightKey(EnrichedItinerary itin)
    {
        return string.Join("|", itin.Segments.SelectMany(s =>
            s.Legs.Select(l => $"{l.OperatingCarrier}{l.OperatingFlightNumber}-{l.DepartureTime:yyyy-MM-ddTHH:mm:ss}")));
    }
}
