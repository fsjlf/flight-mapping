namespace FlightMapping.Api.Models.Sabre.Request;

public class HotelDetailsRequest
{
    public GetHotelDetailsRQ GetHotelDetailsRQ { get; set; } = new();
}

public class GetHotelDetailsRQ
{
    public HotelSearchCriteria SearchCriteria { get; set; } = new();
}

public class HotelSearchCriteria
{
    public HotelRefs HotelRefs { get; set; } = new();
    public RateInfoRef RateInfoRef { get; set; } = new();
    public HotelContentRef? HotelContentRef { get; set; }
}

public class HotelContentRef
{
    public DescriptiveInfoRef? DescriptiveInfoRef { get; set; }
}

public class DescriptiveInfoRef
{
    public bool? PropertyInfo { get; set; }
    public bool? LocationInfo { get; set; }
    public bool? Amenities { get; set; }
    public HotelDescriptions? Descriptions { get; set; }
    public bool? AcceptedCreditCards { get; set; }
    public bool? GuaranteePolicies { get; set; }
}

public class HotelDescriptions
{
    public List<HotelDescriptionType> Description { get; set; } = new();
}

public class HotelDescriptionType
{
    public string Type { get; set; } = string.Empty;
}

public class HotelRefs
{
    public HotelRef HotelRef { get; set; } = new();
}

public class HotelRef
{
    public string HotelCode { get; set; } = string.Empty;
    public string CodeContext { get; set; } = "SABRE";
}

public class RateInfoRef
{
    public string? CurrencyCode { get; set; }
    public bool? ConvertedRateInfoOnly { get; set; }
    public string? PrepaidQualifier { get; set; }
    public StayDateRange? StayDateRange { get; set; }
    public StayDateRange? StayDateTimeRange { get; set; }
    public HotelRooms Rooms { get; set; } = new();
    public string? InfoSource { get; set; }
}

public class StayDateRange
{
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
}

public class HotelRooms
{
    public List<HotelRoom> Room { get; set; } = new();
}

public class HotelRoom
{
    public int Index { get; set; } = 1;
    public int Adults { get; set; } = 1;
    public int Children { get; set; } = 0;
}
