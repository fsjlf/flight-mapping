namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Enums;
using FlightMapping.Api.Models.Sabre.Response;
using FlightMapping.Api.Models.Search.Internal;
using FlightMapping.Api.Models.Search.Output;

public class BfmResponseParser : IBfmResponseParser
{
    private readonly ILogger<BfmResponseParser> _logger;

    public BfmResponseParser(ILogger<BfmResponseParser> logger)
    {
        _logger = logger;
    }

    public List<EnrichedItinerary> Parse(BfmGroupedResponse response, StrategyApiCall apiCall, SearchStrategy strategy)
    {
        var results = new List<EnrichedItinerary>();
        var grouped = response.GroupedItineraryResponse;

        if (grouped.ItineraryGroups.Count == 0)
        {
            _logger.LogWarning("BFM response contains no itinerary groups for call {CallId}", apiCall.CallId);
            return results;
        }

        // Build lookup dictionaries keyed by 1-based ID
        var scheduleLookup = grouped.ScheduleDescs.ToDictionary(s => s.Id);
        var legLookup = grouped.LegDescs.ToDictionary(l => l.Id);
        var fareComponentLookup = (grouped.FareComponentDescs ?? new List<BfmFareComponentDesc>())
            .ToDictionary(f => f.Id);
        var brandLookup = (grouped.BrandDescs ?? new List<BfmBrandDesc>())
            .ToDictionary(b => b.Id);
        var brandFeatureLookup = (grouped.BrandFeatureDescs ?? new List<BfmBrandFeatureDesc>())
            .ToDictionary(f => f.Id);
        var taxLookup = (grouped.TaxDescs ?? new List<BfmTaxDesc>())
            .ToDictionary(t => t.Id);

        // Get group description for departure dates
        var groupDesc = grouped.ItineraryGroups[0].GroupDescription;
        var legDates = groupDesc.LegDescriptions
            .Select(ld => DateOnly.Parse(ld.DepartureDate))
            .ToList();

        var lookups = new ParseLookups
        {
            Schedules = scheduleLookup,
            Legs = legLookup,
            FareComponents = fareComponentLookup,
            Brands = brandLookup,
            BrandFeatures = brandFeatureLookup,
            Taxes = taxLookup,
        };

        foreach (var group in grouped.ItineraryGroups)
        {
            foreach (var itin in group.Itineraries)
            {
                try
                {
                    var enrichedList = ParseItinerary(itin, lookups, legDates, apiCall, strategy);
                    results.AddRange(enrichedList);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse itinerary {ItineraryId} in call {CallId}", itin.Id, apiCall.CallId);
                }
            }
        }

        _logger.LogInformation("Parsed {Count} enriched itineraries from call {CallId}", results.Count, apiCall.CallId);
        return results;
    }

    /// <summary>
    /// Parse all branded fare variants for an itinerary. Each PricingInformation entry
    /// represents a different branded fare (e.g. Basic, Main Cabin, Main Refundable)
    /// for the same physical flights. We emit one EnrichedItinerary per fare variant.
    /// </summary>
    private List<EnrichedItinerary> ParseItinerary(
        BfmItinerary itin,
        ParseLookups lookups,
        List<DateOnly> legDates,
        StrategyApiCall apiCall,
        SearchStrategy strategy)
    {
        var results = new List<EnrichedItinerary>();

        if (itin.PricingInformation.Count == 0)
            return results;

        // Build the physical legs once — shared across all fare variants
        var baseLegData = new List<(BfmLegDesc legDesc, DateOnly departureDate)>();
        for (var legIndex = 0; legIndex < itin.Legs.Count; legIndex++)
        {
            var legRef = itin.Legs[legIndex].Ref;
            if (!lookups.Legs.TryGetValue(legRef, out var legDesc))
            {
                _logger.LogWarning("Leg ref {LegRef} not found in descriptors", legRef);
                continue;
            }
            var departureDate = legIndex < legDates.Count ? legDates[legIndex] : legDates[0];
            baseLegData.Add((legDesc, departureDate));
        }

        // Emit one enriched itinerary per branded fare variant
        for (var pricingIdx = 0; pricingIdx < itin.PricingInformation.Count; pricingIdx++)
        {
            try
            {
                var pricing = itin.PricingInformation[pricingIdx];
                var fare = pricing.Fare;

                // Build segments (each fare variant may have different cabin/class/brand)
                var segments = new List<EnrichedSegment>();
                var totalDuration = 0;
                var totalMiles = 0;

                for (var legIndex = 0; legIndex < baseLegData.Count; legIndex++)
                {
                    var (legDesc, departureDate) = baseLegData[legIndex];
                    var segment = BuildSegment(legDesc, lookups, fare, departureDate, legIndex);
                    segments.Add(segment);
                    totalDuration += segment.DurationMinutes;
                    totalMiles += segment.Legs.Sum(l => l.TotalMilesFlown);
                }

                var itinPricing = BuildPricing(fare, lookups.Taxes);
                var nonRefundable = fare.PassengerInfoList
                    .Any(p => p.PassengerInfo.NonRefundable);
                var fingerprint = BuildFingerprint(segments);

                results.Add(new EnrichedItinerary
                {
                    Id = $"{apiCall.CallId}-{itin.Id}-{pricingIdx}-{fingerprint}",
                    StrategyType = strategy.Type,
                    StrategyDescription = strategy.Description,
                    Segments = segments,
                    TotalDurationMinutes = totalDuration,
                    TotalMilesFlown = totalMiles,
                    Pricing = itinPricing,
                    FarePolicy = new FarePolicy
                    {
                        NonRefundable = nonRefundable,
                        Vita = fare.Vita,
                    },
                    ValidatingCarrier = fare.ValidatingCarrierCode,
                    ETicketable = fare.ETicketable,
                    GoverningCarriers = fare.GoverningCarriers,
                    PricingSource = itin.PricingSource,
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse pricing variant {PricingIdx} for itinerary {ItineraryId}", pricingIdx, itin.Id);
            }
        }

        return results;
    }

    private EnrichedSegment BuildSegment(
        BfmLegDesc legDesc,
        ParseLookups lookups,
        BfmFare fare,
        DateOnly departureDate,
        int legIndex)
    {
        var legs = new List<EnrichedLeg>();
        var currentDate = departureDate;

        foreach (var schedRef in legDesc.Schedules)
        {
            if (!lookups.Schedules.TryGetValue(schedRef.Ref, out var sched))
                continue;

            var adjustedDate = currentDate.AddDays(schedRef.DepartureDateAdjustment);
            var depTime = ParseDateTime(adjustedDate, sched.Departure.Time);
            var arrTime = ParseDateTime(adjustedDate, sched.Arrival.Time, sched.Arrival.DateAdjustment);

            legs.Add(new EnrichedLeg
            {
                Origin = sched.Departure.Airport,
                Destination = sched.Arrival.Airport,
                OriginCity = sched.Departure.City,
                OriginCountry = sched.Departure.Country,
                DestinationCity = sched.Arrival.City,
                DestinationCountry = sched.Arrival.Country,
                DepartureTime = depTime,
                ArrivalTime = arrTime,
                DurationMinutes = sched.ElapsedTime,
                MarketingCarrier = sched.Carrier.Marketing,
                MarketingFlightNumber = sched.Carrier.MarketingFlightNumber,
                OperatingCarrier = sched.Carrier.Operating ?? sched.Carrier.Marketing,
                OperatingFlightNumber = sched.Carrier.OperatingFlightNumber,
                Disclosure = sched.Carrier.Disclosure,
                FlightNumber = $"{sched.Carrier.Marketing}{sched.Carrier.MarketingFlightNumber}",
                Equipment = sched.Carrier.Equipment?.Code ?? "",
                TotalMilesFlown = sched.TotalMilesFlown,
                StopCount = sched.StopCount,
            });
        }

        // Compute connection times between legs
        for (var i = 0; i < legs.Count - 1; i++)
        {
            var connMinutes = (int)(legs[i + 1].DepartureTime - legs[i].ArrivalTime).TotalMinutes;
            legs[i].ConnectionTimeToNextMinutes = connMinutes;
        }

        // Extract booking class, cabin, fare basis, seats, meal from fare components
        var bookingClass = "";
        var cabinCode = "";
        var fareBasisCode = "";
        var seatsAvailable = 0;
        string? mealCode = null;
        BrandInfo? brandInfo = null;

        var passengerInfo = fare.PassengerInfoList.FirstOrDefault()?.PassengerInfo;
        if (passengerInfo?.FareComponents != null)
        {
            foreach (var fcRef in passengerInfo.FareComponents)
            {
                if (!lookups.FareComponents.TryGetValue(fcRef.Ref, out var fareComp))
                    continue;

                if (string.IsNullOrEmpty(fareBasisCode))
                    fareBasisCode = fareComp.FareBasisCode;

                // Get booking details from the fare component's segments
                if (fareComp.Segments != null)
                {
                    foreach (var seg in fareComp.Segments)
                    {
                        if (string.IsNullOrEmpty(bookingClass))
                        {
                            bookingClass = seg.Segment.BookingCode;
                            cabinCode = seg.Segment.CabinCode;
                            seatsAvailable = seg.Segment.SeatsAvailable;
                        }
                    }
                }

                // Also check inline segment booking details
                if (fcRef.Segments != null)
                {
                    foreach (var seg in fcRef.Segments)
                    {
                        if (seg.Segment != null && string.IsNullOrEmpty(bookingClass))
                        {
                            bookingClass = seg.Segment.BookingCode;
                            cabinCode = seg.Segment.CabinCode;
                            seatsAvailable = seg.Segment.SeatsAvailable;
                            mealCode = seg.Segment.MealCode;
                        }
                    }
                }

                // Resolve brand info (inline brand data + features from itinerary-level refs)
                if (brandInfo == null && fareComp.Brand != null)
                {
                    brandInfo = ResolveBrand(fareComp.Brand, fcRef.BrandFeatures, lookups);
                }

                if (!string.IsNullOrEmpty(bookingClass))
                    break;
            }
        }

        // Apply per-leg details
        foreach (var leg in legs)
        {
            leg.BookingClass = bookingClass;
            leg.SeatsAvailable = seatsAvailable;
            leg.MealCode = mealCode;
        }

        var firstLeg = legs.FirstOrDefault();
        var lastLeg = legs.LastOrDefault();
        var stops = Math.Max(0, legs.Count - 1);

        return new EnrichedSegment
        {
            Origin = firstLeg?.Origin ?? "",
            Destination = lastLeg?.Destination ?? "",
            DepartureTime = firstLeg?.DepartureTime ?? DateTime.MinValue,
            ArrivalTime = lastLeg?.ArrivalTime ?? DateTime.MinValue,
            DurationMinutes = legDesc.ElapsedTime,
            MarketingCarrier = firstLeg?.MarketingCarrier ?? "",
            OperatingCarrier = firstLeg?.OperatingCarrier ?? "",
            FlightNumber = firstLeg?.FlightNumber ?? "",
            Equipment = firstLeg?.Equipment ?? "",
            BookingClass = bookingClass,
            Cabin = ParseCabinCode(cabinCode),
            FareBasisCode = fareBasisCode,
            Brand = brandInfo,
            Legs = legs,
            Stops = stops,
        };
    }

    private static BrandInfo? ResolveBrand(
        BfmBrandRef brandRef,
        List<BfmBrandFeatureRef>? featureRefs,
        ParseLookups lookups)
    {
        // Brand name comes inline from fareComponentDesc.brand.brandName
        var brandName = brandRef.BrandName;
        if (string.IsNullOrEmpty(brandName))
        {
            // Fallback: try lookup from brandDescs if available
            if (brandRef.BrandId > 0 && lookups.Brands.TryGetValue(brandRef.BrandId, out var brandDesc))
                brandName = brandDesc.Name;
            else
                return null;
        }

        var features = new List<BrandFeature>();
        if (featureRefs != null)
        {
            foreach (var fRef in featureRefs)
            {
                if (lookups.BrandFeatures.TryGetValue(fRef.Ref, out var featureDesc))
                {
                    features.Add(new BrandFeature
                    {
                        Name = featureDesc.CommercialName,
                        Application = featureDesc.Application,
                        ServiceGroup = featureDesc.ServiceGroup,
                        ServiceType = featureDesc.ServiceType,
                    });
                }
            }
        }

        return new BrandInfo
        {
            Name = brandName,
            Tier = brandRef.BrandId, // use brandId as tier when no separate tier available
            Features = features,
        };
    }

    private static ItineraryPricing BuildPricing(BfmFare fare, Dictionary<int, BfmTaxDesc> taxLookup)
    {
        var total = fare.TotalFare;

        // Count adults for per-adult pricing
        var adultCount = fare.PassengerInfoList
            .Select(p => p.PassengerInfo)
            .Where(p => p.PassengerType == "ADT")
            .Sum(p => p.PassengerNumber);
        if (adultCount == 0) adultCount = 1;

        // Build passenger breakdown
        var passengerBreakdown = fare.PassengerInfoList
            .Select(p => new PassengerPricing
            {
                PassengerType = p.PassengerInfo.PassengerType,
                Count = p.PassengerInfo.PassengerNumber,
                NonRefundable = p.PassengerInfo.NonRefundable,
            })
            .ToList();

        // Tax breakdown from descriptors
        // Note: taxDescs are shared descriptors at the response level.
        // Per-itinerary tax refs aren't in the grouped format, so we surface
        // all known tax codes. Real per-itinerary breakdown will be validated
        // against actual Sabre responses.
        var taxes = taxLookup.Values
            .Select(t => new TaxBreakdown
            {
                Code = t.Code,
                Amount = t.Amount,
                Currency = t.Currency,
            })
            .ToList();

        return new ItineraryPricing
        {
            TotalPrice = total.TotalPrice,
            BasePrice = total.BaseFareAmount,
            TaxesAndFees = total.TotalTaxAmount,
            CurrencyCode = total.Currency,
            BaseFareCurrency = total.BaseFareCurrency,
            EquivalentAmount = total.EquivalentAmount,
            EquivalentCurrency = total.EquivalentCurrency,
            PricePerAdult = Math.Round(total.TotalPrice / adultCount, 2),
            Taxes = taxes,
            PassengerBreakdown = passengerBreakdown,
        };
    }

    private static DateTime ParseDateTime(DateOnly date, string time, int dateAdjustment = 0)
    {
        var adjustedDate = date.AddDays(dateAdjustment);

        // Sabre returns local times with UTC offset like "07:35:00-05:00", "19:25:00Z", "21:45:00+01:00"
        // Strip the offset to parse just the local time
        var timeStr = time.TrimEnd('Z');
        var plusIdx = timeStr.IndexOf('+');
        if (plusIdx > 0)
            timeStr = timeStr[..plusIdx];
        else
        {
            // Find the last '-' that's part of the offset (after the time portion)
            var lastDash = timeStr.LastIndexOf('-');
            if (lastDash > 5) // Must be past HH:MM: to be an offset
                timeStr = timeStr[..lastDash];
        }

        if (TimeOnly.TryParse(timeStr, out var timeOnly))
            return adjustedDate.ToDateTime(timeOnly);

        return adjustedDate.ToDateTime(TimeOnly.MinValue);
    }

    private static CabinClass ParseCabinCode(string cabinCode)
    {
        return cabinCode switch
        {
            "Y" => CabinClass.Economy,
            "S" => CabinClass.PremiumEconomy,
            "C" or "J" => CabinClass.Business,
            "F" or "P" => CabinClass.First,
            _ => CabinClass.Economy
        };
    }

    private static string BuildFingerprint(List<EnrichedSegment> segments)
    {
        var parts = segments.SelectMany(s => s.Legs.Select(l =>
            $"{l.MarketingCarrier}{l.FlightNumber}-{l.DepartureTime:yyyyMMddHHmm}"));
        return string.Join("|", parts).GetHashCode().ToString("x8");
    }

    private record ParseLookups
    {
        public required Dictionary<int, BfmScheduleDesc> Schedules { get; init; }
        public required Dictionary<int, BfmLegDesc> Legs { get; init; }
        public required Dictionary<int, BfmFareComponentDesc> FareComponents { get; init; }
        public required Dictionary<int, BfmBrandDesc> Brands { get; init; }
        public required Dictionary<int, BfmBrandFeatureDesc> BrandFeatures { get; init; }
        public required Dictionary<int, BfmTaxDesc> Taxes { get; init; }
    }
}
