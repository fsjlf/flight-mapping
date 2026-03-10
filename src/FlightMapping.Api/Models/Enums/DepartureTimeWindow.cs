namespace FlightMapping.Api.Models.Enums;

public enum DepartureTimeWindow
{
    Any,
    Morning,    // 06:00 - 11:59
    Afternoon,  // 12:00 - 17:59
    Evening,    // 18:00 - 21:59
    RedEye      // 22:00 - 05:59
}
