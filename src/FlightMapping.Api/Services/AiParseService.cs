namespace FlightMapping.Api.Services;

using System.Text.Json;
using System.Text.Json.Serialization;
using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using FlightMapping.Api.Models.Search.Input;

public class AiParseService : IAiParseService
{
    private readonly AnthropicClient _client;
    private readonly ILogger<AiParseService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private const string SystemPrompt = """
        You are a flight search request parser. Given a natural language description of a travel itinerary,
        extract the structured search parameters.

        Today's date context: use the current year for dates that don't specify a year. If a month has already
        passed this year, assume next year.

        Rules:
        - Origin and destination MUST be 3-letter IATA airport codes. If the user says a city name, resolve it
          to the primary airport code (e.g. "New York" → "JFK", "London" → "LHR", "Tokyo" → "NRT",
          "Paris" → "CDG", "Chicago" → "ORD", "Los Angeles" → "LAX", "San Francisco" → "SFO",
          "Miami" → "MIA", "Dallas" → "DFW", "Atlanta" → "ATL", "Denver" → "DEN",
          "Seattle" → "SEA", "Boston" → "BOS", "Washington" → "DCA", "Houston" → "IAH").
        - Dates must be in YYYY-MM-DD format.
        - Default to 1 adult if not specified.
        - Default cabin is Economy if not specified.
        - For round trips, create two segments (outbound and return).
        - For multi-city, create one segment per city pair.
        - For mixed cabin requests (e.g. "business outbound, economy return"), set cabinOverride on each segment.
        - Only set preferredCarriers if the user explicitly mentions an airline preference (use 2-letter IATA carrier codes e.g. "AA", "DL", "UA", "BA").
        - Only set maxStops if the user explicitly mentions stop preferences (0 for nonstop/direct).
        - IMPORTANT: Omit any field whose value would be null. Do NOT include null values in the JSON.

        Respond with ONLY valid JSON matching this exact schema (no markdown, no explanation).
        Omit optional fields entirely rather than setting them to null:
        {
          "segments": [
            {
              "origin": "IATA",
              "destination": "IATA",
              "departureDate": "YYYY-MM-DD",
              "timePreference": "Any" | "Morning" | "Afternoon" | "Evening" | "RedEye",  // omit if not specified
              "cabinOverride": "Economy" | "PremiumEconomy" | "Business" | "First"  // omit if not specified
            }
          ],
          "passengers": {
            "adults": 1,
            "children": 0,
            "infants": 0,
            "infantsWithSeat": 0
          },
          "preferences": {
            "cabin": "Economy" | "PremiumEconomy" | "Business" | "First",
            "preferredCarriers": ["AA"],  // omit if not specified
            "excludedCarriers": ["NK"],  // omit if not specified
            "maxStops": 0,  // omit if not specified
            "priority": "Price" | "Duration" | "Comfort" | "Balanced"  // omit if not specified, default is "Balanced"
          }
        }
        """;

    public AiParseService(AnthropicClient client, ILogger<AiParseService> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<SearchRequest> ParseAsync(string naturalLanguageInput, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Parsing natural language input with Claude: {InputLength} chars", naturalLanguageInput.Length);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var userMessage = $"Today is {today:yyyy-MM-dd}.\n\nParse this travel request:\n{naturalLanguageInput}";

        var parameters = new MessageParameters
        {
            Model = "claude-sonnet-4-20250514",
            MaxTokens = 1024,
            System = new List<SystemMessage> { new(SystemPrompt) },
            Messages = new List<Message>
            {
                new(RoleType.User, userMessage),
            },
            Temperature = 0m,
        };

        var response = await _client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);

        var json = response.Content
            .OfType<TextContent>()
            .Select(c => c.Text)
            .FirstOrDefault() ?? throw new InvalidOperationException("No text response from Claude");

        // Strip markdown fences if present
        json = json.Trim();
        if (json.StartsWith("```"))
        {
            var firstNewline = json.IndexOf('\n');
            if (firstNewline > 0) json = json[(firstNewline + 1)..];
            if (json.EndsWith("```")) json = json[..^3];
            json = json.Trim();
        }

        _logger.LogDebug("Claude parse response: {Json}", json);

        var result = JsonSerializer.Deserialize<SearchRequest>(json, JsonOptions)
            ?? throw new InvalidOperationException("Failed to deserialize Claude response");

        return result;
    }
}
