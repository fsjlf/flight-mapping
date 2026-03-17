namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;

public class SplitPnrAnalyzer : ISplitPnrAnalyzer
{
    private readonly IWaterfallCalculator _calculator;

    public SplitPnrAnalyzer(IWaterfallCalculator calculator)
    {
        _calculator = calculator;
    }

    public SplitPnrAnalysis Analyze(SplitPnrAnalysisRequest request)
    {
        // Reconstruct fare classes from breakpoints
        var fareClasses = ReconstructFareClasses(request.Breakpoints);

        // Group fare = the last breakpoint (what N-pax search returned)
        var lastBreakpoint = request.Breakpoints.Last();
        var groupFare = new GroupFare
        {
            Rbd = lastBreakpoint.Rbd,
            FarePerPerson = lastBreakpoint.PricePerPerson,
            Total = lastBreakpoint.PricePerPerson * request.TotalPassengers,
        };

        // Build waterfall input
        var waterfallInput = new WaterfallInput
        {
            CabinPhysicalSeats = request.EstimatedPhysicalSeats,
            TotalPassengers = request.TotalPassengers,
            FareClasses = fareClasses,
            GroupFare = groupFare,
        };

        // Run the waterfall
        var waterfall = _calculator.Calculate(waterfallInput);

        // Build PNR groups from allocations
        var pnrs = waterfall.Allocations.Select((a, i) => new PnrGroup
        {
            PnrNumber = i + 1,
            Rbd = a.Rbd,
            PassengerCount = a.Count,
            FarePerPerson = a.FarePerPerson,
            Subtotal = a.Subtotal,
            BrandName = a.BrandName,
            RulesSummary = a.RulesSummary,
        }).ToList();

        // Compute trade-offs
        var tradeOffs = BuildTradeOffs(pnrs, fareClasses);

        return new SplitPnrAnalysis
        {
            FlightKey = request.FlightKey,
            Carrier = request.Carrier,
            Route = request.Route,
            Cabin = request.Cabin,
            TotalPassengers = request.TotalPassengers,
            SingleBooking = new SingleBookingOption
            {
                Rbd = groupFare.Rbd,
                PricePerPerson = groupFare.FarePerPerson,
                Total = groupFare.Total,
                BrandName = fareClasses.FirstOrDefault(f => f.Rbd == groupFare.Rbd)?.BrandName,
                RulesSummary = fareClasses.FirstOrDefault(f => f.Rbd == groupFare.Rbd)?.RulesSummary,
            },
            RecommendedSplit = new SplitBookingOption
            {
                Pnrs = pnrs,
                Total = waterfall.TotalCost,
                AveragePerPerson = request.TotalPassengers > 0
                    ? Math.Round(waterfall.TotalCost / request.TotalPassengers, 2)
                    : 0,
            },
            Waterfall = waterfall,
            Savings = waterfall.Savings,
            SavingsPercent = waterfall.SavingsPercent,
            AveragePricePerPerson = request.TotalPassengers > 0
                ? Math.Round(waterfall.TotalCost / request.TotalPassengers, 2)
                : 0,
            TradeOffs = tradeOffs,
            PriceBreakpoints = request.Breakpoints,
        };
    }

    /// <summary>
    /// Reconstruct fare class info from price breakpoints.
    /// Each breakpoint tells us at what passenger count the price jumped,
    /// revealing the auth cap for the previous class.
    /// </summary>
    private static List<FareClassInfo> ReconstructFareClasses(List<PriceBreakpoint> breakpoints)
    {
        var fareClasses = new List<FareClassInfo>();
        var grouped = breakpoints.GroupBy(b => b.Rbd).OrderBy(g => g.First().PricePerPerson);

        foreach (var group in grouped)
        {
            var bp = group.First();
            fareClasses.Add(new FareClassInfo
            {
                Rbd = bp.Rbd,
                AuthCap = bp.InferredAuthCap,
                FarePerPerson = bp.PricePerPerson,
                Cabin = Models.Enums.CabinClass.Business, // will be set from request
            });
        }

        return fareClasses;
    }

    private static List<string> BuildTradeOffs(List<PnrGroup> pnrs, List<FareClassInfo> fareClasses)
    {
        var tradeOffs = new List<string>();

        if (pnrs.Count > 1)
            tradeOffs.Add($"{pnrs.Count} separate confirmation numbers");

        var cheapest = fareClasses.OrderBy(f => f.FarePerPerson).FirstOrDefault();
        if (cheapest?.RulesSummary != null && cheapest.RulesSummary.Contains("non-refund", StringComparison.OrdinalIgnoreCase))
            tradeOffs.Add($"{cheapest.Rbd} class: non-refundable, limited change options");

        if (pnrs.Count > 1)
            tradeOffs.Add("Each PNR rebooks independently if flight is disrupted");

        if (pnrs.Count > 1)
            tradeOffs.Add("Book seats early to guarantee sitting together");

        var distinctRules = pnrs.Select(p => p.RulesSummary).Where(r => r != null).Distinct().Count();
        if (distinctRules > 1)
            tradeOffs.Add("Mixed fare rules across PNRs");

        return tradeOffs;
    }
}
