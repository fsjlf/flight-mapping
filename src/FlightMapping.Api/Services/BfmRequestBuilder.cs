namespace FlightMapping.Api.Services;

using FlightMapping.Api.Configuration;
using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Sabre.Request;
using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;
using Microsoft.Extensions.Options;

public class BfmRequestBuilder : IBfmRequestBuilder
{
    private readonly SabreOptions _options;

    public BfmRequestBuilder(IOptions<SabreOptions> options)
    {
        _options = options.Value;
    }

    public BfmRequest Build(StrategyApiCall apiCall, SearchRequest searchRequest)
    {
        var effectiveCabin = DetermineEffectiveCabin(apiCall, searchRequest);
        var pax = searchRequest.Passengers;

        var request = new BfmRequest
        {
            SearchRq = new BfmSearchRq
            {
                Pos = new BfmPos
                {
                    Source =
                    [
                        new BfmSource
                        {
                            PseudoCityCode = _options.GroupId.ToUpperInvariant(),
                            RequestorId = new BfmRequestorId()
                        }
                    ]
                },
                OriginDestinationInformation = BuildOriginDestinations(apiCall, searchRequest),
                TravelPreferences = new BfmTravelPreferences
                {
                    CabinPref = [new BfmCabinPref { Cabin = MapCabinCode(effectiveCabin) }],
                    TpaExtensions = new BfmTravelPrefExtensions
                    {
                        NumTrips = new BfmNumTrips { Number = 200 },
                        DataSources = new BfmDataSources()
                    }
                },
                TravelerInfoSummary = BuildTravelerInfo(pax),
                TpaExtensions = new BfmTpaExtensions()
            }
        };

        return request;
    }

    /// <summary>
    /// Determines the effective cabin for an API call. If all segments share the same cabin,
    /// use that. If mixed, use the most permissive (highest) cabin so Sabre doesn't exclude results.
    /// </summary>
    private static CabinClass DetermineEffectiveCabin(StrategyApiCall apiCall, SearchRequest request)
    {
        var globalCabin = request.Preferences?.Cabin ?? CabinClass.Economy;

        var cabins = apiCall.SegmentIndices
            .Select(i => request.Segments[i].CabinOverride ?? globalCabin)
            .Distinct()
            .ToList();

        return cabins.Count == 1 ? cabins[0] : cabins.Max();
    }

    private static List<BfmOriginDestination> BuildOriginDestinations(
        StrategyApiCall apiCall,
        SearchRequest searchRequest)
    {
        var ods = new List<BfmOriginDestination>();

        for (var i = 0; i < apiCall.SegmentIndices.Count; i++)
        {
            var segIndex = apiCall.SegmentIndices[i];
            var seg = searchRequest.Segments[segIndex];

            var timeStr = MapTimePreference(seg.TimePreference);

            ods.Add(new BfmOriginDestination
            {
                Rph = (i + 1).ToString(),
                DepartureDateTime = seg.DepartureDate.ToString("yyyy-MM-dd") + timeStr,
                OriginLocation = new BfmLocation { LocationCode = seg.Origin.ToUpperInvariant() },
                DestinationLocation = new BfmLocation { LocationCode = seg.Destination.ToUpperInvariant() }
            });
        }

        return ods;
    }

    private static string MapTimePreference(DepartureTimeWindow? pref) => pref switch
    {
        DepartureTimeWindow.Morning => "T09:00:00",
        DepartureTimeWindow.Afternoon => "T15:00:00",
        DepartureTimeWindow.Evening => "T20:00:00",
        DepartureTimeWindow.RedEye => "T02:00:00",
        _ => "T00:00:00"
    };

    private static BfmTravelerInfo BuildTravelerInfo(PassengerConfig pax)
    {
        var paxTypes = new List<BfmPassengerTypeQuantity>();

        if (pax.Adults > 0)
            paxTypes.Add(new BfmPassengerTypeQuantity { Code = "ADT", Quantity = pax.Adults });
        if (pax.Children > 0)
            paxTypes.Add(new BfmPassengerTypeQuantity { Code = "CNN", Quantity = pax.Children });
        if (pax.Infants > 0)
            paxTypes.Add(new BfmPassengerTypeQuantity { Code = "INF", Quantity = pax.Infants });
        if (pax.InfantsWithSeat > 0)
            paxTypes.Add(new BfmPassengerTypeQuantity { Code = "INS", Quantity = pax.InfantsWithSeat });

        return new BfmTravelerInfo
        {
            SeatsRequested = [pax.TotalSeated],
            AirTravelerAvail = [new BfmAirTravelerAvail { PassengerTypeQuantity = paxTypes }],
            PriceRequestInformation = new BfmPriceRequestInformation
            {
                TpaExtensions = new BfmPriceReqExtensions
                {
                    BrandedFareIndicators = new BfmBrandedFareIndicators()
                }
            }
        };
    }

    private static string MapCabinCode(CabinClass cabin) => cabin switch
    {
        CabinClass.Economy => "Y",
        CabinClass.PremiumEconomy => "S",
        CabinClass.Business => "C",
        CabinClass.First => "F",
        _ => "Y"
    };
}
