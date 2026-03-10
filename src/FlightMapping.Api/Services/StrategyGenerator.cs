namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;

public class StrategyGenerator : IStrategyGenerator
{
    public SearchExecutionPlan GeneratePlan(SearchRequest request, TripClassification classification)
    {
        var strategies = new List<SearchStrategy>();
        var priority = 0;

        foreach (var strategyType in classification.RecommendedStrategies)
        {
            var strategy = BuildStrategy(strategyType, request, priority++);
            if (strategy != null)
                strategies.Add(strategy);
        }

        var allCalls = strategies.SelectMany(s => s.ApiCalls).ToList();

        return new SearchExecutionPlan
        {
            PlanId = Guid.NewGuid().ToString("N")[..12],
            Classification = classification,
            Strategies = strategies,
            TotalApiCalls = allCalls.Count,
            ExecutionWaves = allCalls.Count > 0 ? allCalls.Max(c => c.Wave) + 1 : 0
        };
    }

    private static SearchStrategy? BuildStrategy(
        TicketingStrategyType type,
        SearchRequest request,
        int priority)
    {
        return type switch
        {
            TicketingStrategyType.SingleTicket => BuildSingleTicket(request, priority),
            TicketingStrategyType.SeparateOneWays => BuildSeparateOneWays(request, priority),
            TicketingStrategyType.HybridRtPlusOw => BuildHybridRtPlusOw(request, priority),
            TicketingStrategyType.CarrierOptimized => BuildSeparateOneWays(request, priority), // Same as OWs for Phase 1
            _ => null
        };
    }

    private static SearchStrategy BuildSingleTicket(SearchRequest request, int priority)
    {
        var strategyId = "strategy-single";
        var allIndices = Enumerable.Range(0, request.Segments.Count).ToList();

        var group = new StrategyTicketGroup
        {
            GroupId = $"{strategyId}-group-all",
            SegmentIndices = allIndices,
            Label = request.Segments.Count == 2 ? "Round trip" : "Multi-city ticket"
        };

        var apiCall = new StrategyApiCall
        {
            CallId = $"{strategyId}-call-0",
            StrategyId = strategyId,
            TicketGroupId = group.GroupId,
            SegmentIndices = allIndices,
            Wave = 0
        };

        return new SearchStrategy
        {
            Id = strategyId,
            Type = TicketingStrategyType.SingleTicket,
            Description = "All segments on one ticket",
            TicketGroups = [group],
            Hypothesis = "Single ticket often cheaper for round trips and circle trips due to RT pricing rules",
            Priority = priority,
            ApiCalls = [apiCall]
        };
    }

    private static SearchStrategy BuildSeparateOneWays(SearchRequest request, int priority)
    {
        var strategyId = "strategy-separate-ows";
        var groups = new List<StrategyTicketGroup>();
        var calls = new List<StrategyApiCall>();

        for (var i = 0; i < request.Segments.Count; i++)
        {
            var seg = request.Segments[i];
            var group = new StrategyTicketGroup
            {
                GroupId = $"{strategyId}-group-{i}",
                SegmentIndices = [i],
                Label = $"One-way {seg.Origin}→{seg.Destination}"
            };
            groups.Add(group);

            calls.Add(new StrategyApiCall
            {
                CallId = $"{strategyId}-call-{i}",
                StrategyId = strategyId,
                TicketGroupId = group.GroupId,
                SegmentIndices = [i],
                Wave = 0
            });
        }

        return new SearchStrategy
        {
            Id = strategyId,
            Type = TicketingStrategyType.SeparateOneWays,
            Description = "Each segment as a separate one-way ticket",
            TicketGroups = groups,
            Hypothesis = "Separate one-ways can be cheaper when outbound/return have different demand or mixed carriers",
            Priority = priority,
            ApiCalls = calls
        };
    }

    private static SearchStrategy? BuildHybridRtPlusOw(SearchRequest request, int priority)
    {
        if (request.Segments.Count < 2)
            return null;

        var strategyId = "strategy-hybrid-rt-ow";
        var groups = new List<StrategyTicketGroup>();
        var calls = new List<StrategyApiCall>();

        // Pair first and last segments as RT-like, rest as OWs
        var rtGroup = new StrategyTicketGroup
        {
            GroupId = $"{strategyId}-group-rt",
            SegmentIndices = [0, request.Segments.Count - 1],
            Label = $"RT pair {request.Segments[0].Origin}→{request.Segments[0].Destination}"
        };
        groups.Add(rtGroup);

        calls.Add(new StrategyApiCall
        {
            CallId = $"{strategyId}-call-rt",
            StrategyId = strategyId,
            TicketGroupId = rtGroup.GroupId,
            SegmentIndices = [0, request.Segments.Count - 1],
            Wave = 0
        });

        // Middle segments as OWs
        for (var i = 1; i < request.Segments.Count - 1; i++)
        {
            var seg = request.Segments[i];
            var owGroup = new StrategyTicketGroup
            {
                GroupId = $"{strategyId}-group-ow-{i}",
                SegmentIndices = [i],
                Label = $"One-way {seg.Origin}→{seg.Destination}"
            };
            groups.Add(owGroup);

            calls.Add(new StrategyApiCall
            {
                CallId = $"{strategyId}-call-ow-{i}",
                StrategyId = strategyId,
                TicketGroupId = owGroup.GroupId,
                SegmentIndices = [i],
                Wave = 0
            });
        }

        return new SearchStrategy
        {
            Id = strategyId,
            Type = TicketingStrategyType.HybridRtPlusOw,
            Description = "Main pair as round trip, extra segments as one-ways",
            TicketGroups = groups,
            Hypothesis = "Hybrid approach exploits RT pricing for the main pair while allowing flexibility on extra segments",
            Priority = priority,
            ApiCalls = calls
        };
    }
}
