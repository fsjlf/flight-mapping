namespace FlightMapping.Api.Services;

using System.Diagnostics;
using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Sabre.Response;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;
using FlightMapping.Api.Models.Search.Output;

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

        _logger.LogInformation("Starting search {SearchId} with {SegmentCount} segments", searchId, request.Segments.Count);

        // 1. Classify trip
        var classification = _tripClassifier.Classify(request.Segments);
        _logger.LogInformation("Trip classified as {TripType} with {StrategyCount} strategies",
            classification.Type, classification.RecommendedStrategies.Count);

        // 2. Generate execution plan
        var plan = _strategyGenerator.GeneratePlan(request, classification);
        _logger.LogInformation("Execution plan: {CallCount} API calls in {WaveCount} waves",
            plan.TotalApiCalls, plan.ExecutionWaves);

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

        // 7. Sort by rank and cap results to keep payload manageable
        const int maxResults = 1500;
        var ranked = deduplicated.OrderBy(i => i.Rank).Take(maxResults).ToList();

        if (deduplicated.Count > maxResults)
            _logger.LogInformation("Capped results from {Total} to {Max}", deduplicated.Count, maxResults);

        stopwatch.Stop();

        return new SearchResponse
        {
            SearchId = searchId,
            Classification = classification,
            Itineraries = ranked,
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

            _logger.LogInformation("Strategy {StrategyId} call {CallId}: {Count} itineraries in {Ms}ms",
                strategy.Id, apiCall.CallId, itineraries.Count, sw.ElapsedMilliseconds);

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
            $"{s.BookingClass}:{s.Brand?.Name ?? ""}"));

        return $"{fingerprint}|{itin.ValidatingCarrier}|{fareKey}";
    }
}
