namespace FlightMapping.Api.Models.Sabre.Response;

public class HotelDetailsResponse
{
    public GetHotelDetailsRS? GetHotelDetailsRS { get; set; }
}

public class GetHotelDetailsRS
{
    public HotelDetailsApplicationResults? ApplicationResults { get; set; }
    public HotelDetailsInfo? HotelDetailsInfo { get; set; }
}

public class HotelDetailsApplicationResults
{
    public string? Status { get; set; }
}

public class HotelDetailsInfo
{
    public HotelInfo? HotelInfo { get; set; }
    public HotelDescriptiveInfo? HotelDescriptiveInfo { get; set; }
    public HotelRateInfo? HotelRateInfo { get; set; }
}

public class HotelInfo
{
    public string? HotelCode { get; set; }
    public string? CodeContext { get; set; }
    public string? HotelName { get; set; }
    public string? ChainCode { get; set; }
    public string? ChainName { get; set; }
    public string? BrandCode { get; set; }
    public string? BrandName { get; set; }
    public string? SabreRating { get; set; }
    public string? SabreHotelCode { get; set; }
}

public class HotelDescriptiveInfo
{
    // Placeholder — populated when HotelContentRef is included in request
}

public class HotelRateInfo
{
    public RateInfos? RateInfos { get; set; }
    public HotelRoomsResponse? Rooms { get; set; }
}

public class HotelRoomsResponse
{
    public List<HotelRoomResponse>? Room { get; set; }
}

public class HotelRoomResponse
{
    public int? RoomIndex { get; set; }
    public int? Adults { get; set; }
    public int? Children { get; set; }
    public string? RoomType { get; set; }
    public int? RoomTypeCode { get; set; }
    public string? RoomCategory { get; set; }
    public string? RoomID { get; set; }
    public int? RoomViewCode { get; set; }
    public string? RoomViewDescription { get; set; }
    public RoomBedTypeOptions? BedTypeOptions { get; set; }
    public RoomDescription? RoomDescription { get; set; }
    public RoomAmenities? Amenities { get; set; }
    public RoomRatePlans? RatePlans { get; set; }
}

public class RoomBedTypeOptions
{
    public List<RoomBedTypes>? BedTypes { get; set; }
}

public class RoomBedTypes
{
    public List<RoomBedType>? BedType { get; set; }
}

public class RoomBedType
{
    public int? Code { get; set; }
    public string? Description { get; set; }
    public int? Count { get; set; }
}

public class RoomDescription
{
    public string? Name { get; set; }
    public List<string>? Text { get; set; }
}

public class RoomAmenities
{
    public List<RoomAmenity>? Amenity { get; set; }
}

public class RoomAmenity
{
    public int? Code { get; set; }
    public string? Description { get; set; }
}

public class RoomRatePlans
{
    public List<RoomRatePlan>? RatePlan { get; set; }
}

public class RoomRatePlan
{
    public string? RatePlanName { get; set; }
    public string? RatePlanCode { get; set; }
    public string? RatePlanType { get; set; }
    public string? RatePlanTypeDescription { get; set; }
    public bool? PrepaidIndicator { get; set; }
    public string? RateSource { get; set; }
    public string? RateKey { get; set; }
    public string? ProductCode { get; set; }
    public RatePlanDescription? RatePlanDescription { get; set; }
    public RoomConvertedRateInfo? ConvertedRateInfo { get; set; }
}

public class RatePlanDescription
{
    public List<string>? Text { get; set; }
}

public class RoomConvertedRateInfo
{
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? AmountBeforeTax { get; set; }
    public string? AmountAfterTax { get; set; }
    public string? AverageNightlyRate { get; set; }
    public string? AverageNightlyRateBeforeTax { get; set; }
    public string? ApproxTotalPrice { get; set; }
    public string? CurrencyCode { get; set; }
    public bool? AdditionalFeesInclusive { get; set; }
    public bool? TaxInclusive { get; set; }
    public string? RateSource { get; set; }
    public string? RateKey { get; set; }
    public RoomRates? Rates { get; set; }
    public RoomCancelPenalties? CancelPenalties { get; set; }
    public RoomGuarantee? Guarantee { get; set; }
}

public class RoomRates
{
    public List<RoomRate>? Rate { get; set; }
}

public class RoomRate
{
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? AmountBeforeTax { get; set; }
    public string? AmountAfterTax { get; set; }
    public string? CurrencyCode { get; set; }
}

public class RoomCancelPenalties
{
    public List<RoomCancelPenalty>? CancelPenalty { get; set; }
}

public class RoomCancelPenalty
{
    public bool? Refundable { get; set; }
    public string? CancelDeadline { get; set; }
    public RoomPenaltyAmount? PenaltyAmount { get; set; }
}

public class RoomPenaltyAmount
{
    public string? Amount { get; set; }
    public string? CurrencyCode { get; set; }
}

public class RoomGuarantee
{
    public string? GuaranteeType { get; set; }
}

public class RateInfos
{
    public List<ConvertedRateInfo>? ConvertedRateInfo { get; set; }
}

public class ConvertedRateInfo
{
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? AmountBeforeTax { get; set; }
    public string? AmountAfterTax { get; set; }
    public string? AverageNightlyRate { get; set; }
    public string? AverageNightlyRateBeforeTax { get; set; }
    public string? HighestNightlyRate { get; set; }
    public string? ApproxTotalPrice { get; set; }
    public string? CurrencyCode { get; set; }
    public bool? AdditionalFeesInclusive { get; set; }
    public bool? TaxInclusive { get; set; }
    public string? RateSource { get; set; }
    public string? RateKey { get; set; }
    public HotelCommission? Commission { get; set; }
}

public class HotelCommission
{
    public decimal? Percent { get; set; }
    public string? Type { get; set; }
    public CommissionDescription? CommissionDescription { get; set; }
}

public class CommissionDescription
{
    public List<string>? Text { get; set; }
}
