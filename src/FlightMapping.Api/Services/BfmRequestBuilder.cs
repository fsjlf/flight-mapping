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
        var pax = searchRequest.Passengers;
        var globalCabin = searchRequest.Preferences?.Cabin ?? CabinClass.Economy;

        // Collect the effective cabin for each segment in this call
        var segCabins = apiCall.SegmentIndices
            .Select(i => searchRequest.Segments[i].CabinOverride ?? globalCabin)
            .ToList();
        var hasMixedCabins = segCabins.Distinct().Count() > 1;

        // Global CabinPref is ALWAYS set (Sabre needs a baseline).
        // For mixed-cabin, per-OD TPA_Extensions.CabinPref overrides it per leg.
        var globalCabinPrefs = BuildGlobalCabinPrefs(apiCall, searchRequest, segCabins);

        // Determine trip type for TPA_Extensions
        var isRoundTrip = apiCall.SegmentIndices.Count == 2
            && searchRequest.Segments.Count >= 2;

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
                OriginDestinationInformation = BuildOriginDestinations(apiCall, searchRequest, segCabins, hasMixedCabins),
                TravelPreferences = new BfmTravelPreferences
                {
                    CabinPref = globalCabinPrefs,
                    TpaExtensions = new BfmTravelPrefExtensions
                    {
                        NumTrips = new BfmNumTrips { Number = 200 },
                        DataSources = new BfmDataSources(),
                        // Signal roundtrip when we have 2 ODs — helps Sabre with mixed-cabin pairing
                        TripType = isRoundTrip ? new BfmTripType { Value = "Return" } : null
                    }
                },
                TravelerInfoSummary = BuildTravelerInfo(pax),
                TpaExtensions = new BfmTpaExtensions()
            }
        };

        return request;
    }

    /// <summary>
    /// Build global CabinPref — always present as the baseline.
    /// For single-cabin searches, this is the only cabin preference needed.
    /// For mixed-cabin, per-OD overrides will supplement this.
    /// </summary>
    private static List<BfmCabinPref> BuildGlobalCabinPrefs(
        StrategyApiCall apiCall,
        SearchRequest request,
        List<CabinClass> segCabins)
    {
        var allCabins = new HashSet<CabinClass>();

        // Always include all distinct cabins from the segments
        foreach (var c in segCabins)
            allCabins.Add(c);

        // Also consider global multi-cabin prefs if no per-segment overrides
        var hasAnyOverride = apiCall.SegmentIndices
            .Any(i => request.Segments[i].CabinOverride.HasValue);

        if (!hasAnyOverride && request.Preferences?.Cabins is { Count: > 0 })
        {
            foreach (var c in request.Preferences.Cabins)
                allCabins.Add(c);
        }

        return allCabins
            .OrderBy(c => c)
            .Select(c => new BfmCabinPref { Cabin = MapCabinCode(c) })
            .ToList();
    }

    private static List<BfmOriginDestination> BuildOriginDestinations(
        StrategyApiCall apiCall,
        SearchRequest searchRequest,
        List<CabinClass> segCabins,
        bool hasMixedCabins)
    {
        var ods = new List<BfmOriginDestination>();

        for (var i = 0; i < apiCall.SegmentIndices.Count; i++)
        {
            var segIndex = apiCall.SegmentIndices[i];
            var seg = searchRequest.Segments[segIndex];

            var timeStr = MapTimePreference(seg.TimePreference);

            var od = new BfmOriginDestination
            {
                Rph = (i + 1).ToString(),
                DepartureDateTime = seg.DepartureDate.ToString("yyyy-MM-dd") + timeStr,
                OriginLocation = new BfmLocation { LocationCode = seg.Origin.ToUpperInvariant() },
                DestinationLocation = new BfmLocation { LocationCode = seg.Destination.ToUpperInvariant() }
            };

            // When segments have different cabin requirements, set per-OD cabin override
            // AND SegmentType Code="O" to signal Sabre this is an individual leg with its own cabin.
            // The global CabinPref remains set as the baseline.
            if (hasMixedCabins)
            {
                od.TpaExtensions = new BfmOdTpaExtensions
                {
                    CabinPref = new BfmCabinPref { Cabin = MapCabinCode(segCabins[i]) },
                    SegmentType = new BfmSegmentType { Code = "O" }
                };
            }

            ods.Add(od);
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
