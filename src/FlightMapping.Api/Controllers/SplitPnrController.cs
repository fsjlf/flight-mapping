namespace FlightMapping.Api.Controllers;

using FlightMapping.Api.Models.SplitPnr;
using FlightMapping.Api.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/split-pnr")]
public class SplitPnrController : ControllerBase
{
    private readonly ISplitPnrAnalyzer _analyzer;
    private readonly IWaterfallCalculator _calculator;
    private readonly ILogger<SplitPnrController> _logger;

    public SplitPnrController(
        ISplitPnrAnalyzer analyzer,
        IWaterfallCalculator calculator,
        ILogger<SplitPnrController> logger)
    {
        _analyzer = analyzer;
        _calculator = calculator;
        _logger = logger;
    }

    /// <summary>
    /// Run full split PNR analysis from price breakpoints.
    /// Called when user clicks "Show Split Options" on a flagged itinerary.
    /// </summary>
    [HttpPost("analyze")]
    public IActionResult Analyze([FromBody] SplitPnrAnalysisRequest request)
    {
        if (request.Breakpoints.Count == 0)
            return BadRequest(new { error = "At least one price breakpoint is required" });

        if (request.TotalPassengers < 2)
            return BadRequest(new { error = "Split PNR requires at least 2 passengers" });

        _logger.LogInformation("Split PNR analysis: {Route} for {Pax} pax, {Breakpoints} breakpoints",
            request.Route, request.TotalPassengers, request.Breakpoints.Count);

        var analysis = _analyzer.Analyze(request);
        return Ok(analysis);
    }

    /// <summary>
    /// Run waterfall with custom user-defined allocations (What-If configurator).
    /// </summary>
    [HttpPost("calculate-custom")]
    public IActionResult CalculateCustom([FromBody] CustomWaterfallRequest request)
    {
        if (request.Allocations.Count == 0)
            return BadRequest(new { error = "At least one allocation is required" });

        var tuples = request.Allocations.Select(a => (a.Rbd, a.Count)).ToList();
        var result = _calculator.CalculateCustom(request.Input, tuples);
        return Ok(result);
    }

    /// <summary>
    /// Run the core waterfall algorithm directly (for testing/debugging).
    /// </summary>
    [HttpPost("waterfall")]
    public IActionResult RunWaterfall([FromBody] WaterfallInput input)
    {
        if (input.FareClasses.Count == 0)
            return BadRequest(new { error = "At least one fare class is required" });

        var result = _calculator.Calculate(input);
        return Ok(result);
    }
}

public class CustomWaterfallRequest
{
    public WaterfallInput Input { get; set; } = new();
    public List<CustomAllocation> Allocations { get; set; } = new();
}

public class CustomAllocation
{
    public string Rbd { get; set; } = string.Empty;
    public int Count { get; set; }
}
