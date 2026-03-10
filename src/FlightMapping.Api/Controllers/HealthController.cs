namespace FlightMapping.Api.Controllers;

using FlightMapping.Api.Configuration;
using FlightMapping.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ISabreClient _sabreClient;
    private readonly ISabreTokenService _tokenService;
    private readonly SabreOptions _options;

    public HealthController(
        ISabreClient sabreClient,
        ISabreTokenService tokenService,
        IOptions<SabreOptions> options)
    {
        _sabreClient = sabreClient;
        _tokenService = tokenService;
        _options = options.Value;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            sabreEnvironment = _options.Environment,
            sabreBaseUrl = _options.BaseUrl
        });
    }

    [HttpGet("sabre/token")]
    public async Task<IActionResult> TestSabreToken(CancellationToken cancellationToken)
    {
        try
        {
            var token = await _tokenService.GetTokenAsync(cancellationToken);
            return Ok(new
            {
                status = "success",
                message = "Sabre token acquired successfully",
                tokenPrefix = token[..Math.Min(10, token.Length)] + "...",
                environment = _options.Environment
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new
            {
                status = "error",
                message = "Failed to acquire Sabre token",
                error = ex.Message,
                environment = _options.Environment
            });
        }
    }

    [HttpGet("sabre/connection")]
    public async Task<IActionResult> TestSabreConnection(CancellationToken cancellationToken)
    {
        var isConnected = await _sabreClient.TestConnectionAsync(cancellationToken);
        return isConnected
            ? Ok(new { status = "connected", environment = _options.Environment })
            : StatusCode(503, new { status = "disconnected", environment = _options.Environment });
    }
}
