namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Models.Search.Internal;

public interface IStrategyGenerator
{
    SearchExecutionPlan GeneratePlan(SearchRequest request, TripClassification classification);
}
