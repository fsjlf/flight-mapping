namespace FlightMapping.Api.Services;

using FlightMapping.Api.Models.SplitPnr;

public interface IWaterfallCalculator
{
    WaterfallResult Calculate(WaterfallInput input);
    WaterfallResult CalculateCustom(WaterfallInput input, List<(string Rbd, int Count)> customAllocations);
}
