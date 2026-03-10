namespace FlightMapping.Api.Controllers;

using FlightMapping.Api.Models.Search.Input;
using FlightMapping.Api.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly ISearchOrchestrator _orchestrator;
    private readonly ILogger<SearchController> _logger;

    public SearchController(ISearchOrchestrator orchestrator, ILogger<SearchController> logger)
    {
        _orchestrator = orchestrator;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Search([FromBody] SearchRequest request, CancellationToken cancellationToken)
    {
        if (request.Segments.Count == 0)
            return BadRequest(new { error = "At least one segment is required" });

        if (request.Passengers.Adults < 1)
            return BadRequest(new { error = "At least one adult passenger is required" });

        _logger.LogInformation("Search request received: {SegmentCount} segments, {PaxCount} passengers",
            request.Segments.Count, request.Passengers.TotalSeated);

        var response = await _orchestrator.SearchAsync(request, cancellationToken);

        return Ok(response);
    }
}
