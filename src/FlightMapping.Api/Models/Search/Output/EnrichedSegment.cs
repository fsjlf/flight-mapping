namespace FlightMapping.Api.Models.Search.Output;

using FlightMapping.Api.Models.Enums;

public class EnrichedSegment
{
    public string Origin { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public int DurationMinutes { get; set; }
    public string DurationFormatted { get; set; } = string.Empty;
    public string MarketingCarrier { get; set; } = string.Empty;
    public string OperatingCarrier { get; set; } = string.Empty;
    public string FlightNumber { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string BookingClass { get; set; } = string.Empty;
    public CabinClass Cabin { get; set; }
    public string FareBasisCode { get; set; } = string.Empty;
    public BrandInfo? Brand { get; set; }
    public List<EnrichedLeg> Legs { get; set; } = new();
    public int Stops { get; set; }
    public int? ConnectionTimeMinutes { get; set; }
    public string? ConnectionTimeFormatted { get; set; }
}

public class BrandInfo
{
    public string Name { get; set; } = string.Empty;
    public int Tier { get; set; }
    public List<BrandFeature> Features { get; set; } = new();
}

public class BrandFeature
{
    public string Name { get; set; } = string.Empty;
    public string? Application { get; set; }
    public string? ServiceGroup { get; set; }
    public string? ServiceType { get; set; }
}
