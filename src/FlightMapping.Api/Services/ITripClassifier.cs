namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;

public interface ITripClassifier
{
    TripClassification Classify(List<SegmentInput> segments);
}
