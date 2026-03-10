namespace FlightMapping.Api.Models.Search.Input;

public class PassengerConfig
{
    public int Adults { get; set; } = 1;
    public int Children { get; set; }
    public int Infants { get; set; }
    public int InfantsWithSeat { get; set; }

    public int TotalSeated => Adults + Children + InfantsWithSeat;
}
