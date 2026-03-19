namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;
using FlightMapping.Api.Models.Search.Output;

public interface ISplitPnrDetector
{
    /// <summary>
    /// Compare 1-pax and N-pax itineraries to detect split PNR savings opportunities.
    /// </summary>
    List<SplitPnrDetection> Detect(
        List<EnrichedItinerary> groupItineraries,
        List<EnrichedItinerary> singlePaxItineraries,
        int totalPassengers);
}
