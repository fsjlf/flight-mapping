namespace FlightMapping.Api.Controllers;

using FlightMapping.Api.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ParseController : ControllerBase
{
    private readonly IAiParseService _parser;
    private readonly ILogger<ParseController> _logger;

    public ParseController(IAiParseService parser, ILogger<ParseController> logger)
    {
        _parser = parser;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Parse([FromBody] ParseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "Text is required" });

        try
        {
            var searchRequest = await _parser.ParseAsync(request.Text, cancellationToken);
            return Ok(searchRequest);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI parse failed");
            return StatusCode(500, new { error = "Failed to parse your request. Please try rephrasing or use the manual form." });
        }
    }

    public record ParseRequest(string Text);
}
