namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;

public class WaterfallCalculator : IWaterfallCalculator
{
    /// <summary>
    /// Greedy cheapest-first allocation with bidirectional waterfall.
    /// Every booking consumes 1 physical seat (affects ALL classes).
    /// Authorization nests upward: booking class X reduces auth for X and everything above.
    /// </summary>
    public WaterfallResult Calculate(WaterfallInput input)
    {
        var classes = input.FareClasses
            .OrderBy(fc => fc.FarePerPerson)
            .ToList();

        var physicalRemaining = input.CabinPhysicalSeats;
        var remainingPax = input.TotalPassengers;

        // Track auth remaining per class
        var authRemaining = classes.ToDictionary(c => c.Rbd, c => c.AuthCap);

        var allocations = new List<WaterfallAllocation>();
        var snapshots = new List<WaterfallSnapshot>
        {
            TakeSnapshot("Initial", classes, authRemaining, physicalRemaining)
        };

        foreach (var fareClass in classes)
        {
            if (remainingPax <= 0) break;

            var available = Math.Min(authRemaining[fareClass.Rbd], physicalRemaining);
            var canFill = Math.Min(available, remainingPax);

            if (canFill <= 0) continue;

            allocations.Add(new WaterfallAllocation
            {
                Rbd = fareClass.Rbd,
                Count = canFill,
                FarePerPerson = fareClass.FarePerPerson,
                Subtotal = canFill * fareClass.FarePerPerson,
                BrandName = fareClass.BrandName,
                RulesSummary = fareClass.RulesSummary,
                FareBasisCode = fareClass.FareBasisCode,
            });

            remainingPax -= canFill;

            // === BIDIRECTIONAL WATERFALL ===

            // 1. Physical seats decrease (affects ALL classes, up AND down)
            physicalRemaining -= canFill;

            // 2. Authorization decreases for this class and everything ABOVE it
            foreach (var c in classes.Where(c => c.FarePerPerson >= fareClass.FarePerPerson))
            {
                authRemaining[c.Rbd] -= canFill;
            }

            snapshots.Add(TakeSnapshot(
                $"Book {canFill} in {fareClass.Rbd} @ ${fareClass.FarePerPerson:N0}",
                classes, authRemaining, physicalRemaining));
        }

        if (remainingPax > 0)
        {
            return new WaterfallResult
            {
                Feasible = false,
                FailureReason = $"Not enough seats across all classes. {remainingPax} passengers unaccommodated.",
                Snapshots = snapshots,
                GroupCost = input.GroupFare.Total,
            };
        }

        var totalCost = allocations.Sum(a => a.Subtotal);
        var groupCost = input.GroupFare.Total;
        var savings = groupCost - totalCost;
        var savingsPercent = groupCost > 0 ? (double)(savings / groupCost) * 100 : 0;

        return new WaterfallResult
        {
            Feasible = true,
            Allocations = allocations,
            TotalCost = totalCost,
            GroupCost = groupCost,
            Savings = savings,
            SavingsPercent = Math.Round(savingsPercent, 1),
            Snapshots = snapshots,
        };
    }

    /// <summary>
    /// Run the waterfall with user-specified allocations (for the What-If configurator).
    /// Validates feasibility and recalculates costs with proper waterfall drain.
    /// </summary>
    public WaterfallResult CalculateCustom(WaterfallInput input, List<(string Rbd, int Count)> customAllocations)
    {
        var classes = input.FareClasses.OrderBy(fc => fc.FarePerPerson).ToList();
        var classLookup = classes.ToDictionary(c => c.Rbd);
        var physicalRemaining = input.CabinPhysicalSeats;
        var authRemaining = classes.ToDictionary(c => c.Rbd, c => c.AuthCap);

        var allocations = new List<WaterfallAllocation>();
        var snapshots = new List<WaterfallSnapshot>
        {
            TakeSnapshot("Initial", classes, authRemaining, physicalRemaining)
        };

        var totalAllocated = 0;

        foreach (var (rbd, count) in customAllocations)
        {
            if (count <= 0) continue;
            if (!classLookup.TryGetValue(rbd, out var fareClass)) continue;

            var available = Math.Min(authRemaining[rbd], physicalRemaining);
            if (count > available)
            {
                return new WaterfallResult
                {
                    Feasible = false,
                    FailureReason = $"Cannot allocate {count} to {rbd}: only {available} available (auth={authRemaining[rbd]}, physical={physicalRemaining}).",
                    Snapshots = snapshots,
                    GroupCost = input.GroupFare.Total,
                };
            }

            allocations.Add(new WaterfallAllocation
            {
                Rbd = rbd,
                Count = count,
                FarePerPerson = fareClass.FarePerPerson,
                Subtotal = count * fareClass.FarePerPerson,
                BrandName = fareClass.BrandName,
                RulesSummary = fareClass.RulesSummary,
                FareBasisCode = fareClass.FareBasisCode,
            });

            totalAllocated += count;
            physicalRemaining -= count;

            foreach (var c in classes.Where(c => c.FarePerPerson >= fareClass.FarePerPerson))
                authRemaining[c.Rbd] -= count;

            snapshots.Add(TakeSnapshot(
                $"Book {count} in {rbd} @ ${fareClass.FarePerPerson:N0}",
                classes, authRemaining, physicalRemaining));
        }

        if (totalAllocated != input.TotalPassengers)
        {
            return new WaterfallResult
            {
                Feasible = false,
                FailureReason = $"Allocated {totalAllocated} but need {input.TotalPassengers} passengers.",
                Allocations = allocations,
                Snapshots = snapshots,
                GroupCost = input.GroupFare.Total,
            };
        }

        var totalCost = allocations.Sum(a => a.Subtotal);
        var groupCost = input.GroupFare.Total;
        var savings = groupCost - totalCost;
        var savingsPercent = groupCost > 0 ? (double)(savings / groupCost) * 100 : 0;

        return new WaterfallResult
        {
            Feasible = true,
            Allocations = allocations,
            TotalCost = totalCost,
            GroupCost = groupCost,
            Savings = savings,
            SavingsPercent = Math.Round(savingsPercent, 1),
            Snapshots = snapshots,
        };
    }

    private static WaterfallSnapshot TakeSnapshot(
        string label,
        List<FareClassInfo> classes,
        Dictionary<string, int> authRemaining,
        int physicalRemaining)
    {
        return new WaterfallSnapshot
        {
            Label = label,
            PhysicalRemaining = physicalRemaining,
            Classes = classes.Select(c =>
            {
                var auth = authRemaining[c.Rbd];
                var effective = Math.Min(Math.Max(auth, 0), Math.Max(physicalRemaining, 0));
                return new ClassSnapshot
                {
                    Rbd = c.Rbd,
                    AuthRemaining = auth,
                    PhysicalRemaining = physicalRemaining,
                    EffectiveAvailable = effective,
                    Fare = c.FarePerPerson,
                    BindingConstraint = auth < physicalRemaining ? "cap"
                        : auth > physicalRemaining ? "physical"
                        : "both",
                };
            }).ToList(),
        };
    }
}
