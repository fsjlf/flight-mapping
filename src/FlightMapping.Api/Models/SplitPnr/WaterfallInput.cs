namespace FlightMapping.Api.Models.SplitPnr;

public class WaterfallInput
{
    public int CabinPhysicalSeats { get; set; }
    public int TotalPassengers { get; set; }
    public List<FareClassInfo> FareClasses { get; set; } = new();
    public GroupFare GroupFare { get; set; } = new();
}

public class GroupFare
{
    public string Rbd { get; set; } = string.Empty;
    public decimal FarePerPerson { get; set; }
    public decimal Total { get; set; }
}
