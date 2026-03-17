namespace FlightMapping.Api.Models.SplitPnr;

public class WaterfallResult
{
    public bool Feasible { get; set; }
    public string? FailureReason { get; set; }
    public List<WaterfallAllocation> Allocations { get; set; } = new();
    public decimal TotalCost { get; set; }
    public decimal GroupCost { get; set; }
    public decimal Savings { get; set; }
    public double SavingsPercent { get; set; }
    public List<WaterfallSnapshot> Snapshots { get; set; } = new();
}

public class WaterfallAllocation
{
    public string Rbd { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal FarePerPerson { get; set; }
    public decimal Subtotal { get; set; }
    public string? BrandName { get; set; }
    public string? RulesSummary { get; set; }
    public string? FareBasisCode { get; set; }
}

public class WaterfallSnapshot
{
    public string Label { get; set; } = string.Empty;
    public int PhysicalRemaining { get; set; }
    public List<ClassSnapshot> Classes { get; set; } = new();
}

public class ClassSnapshot
{
    public string Rbd { get; set; } = string.Empty;
    public int AuthRemaining { get; set; }
    public int PhysicalRemaining { get; set; }
    public int EffectiveAvailable { get; set; }
    public decimal Fare { get; set; }
    public string BindingConstraint { get; set; } = string.Empty; // "cap", "physical", "both"
}
