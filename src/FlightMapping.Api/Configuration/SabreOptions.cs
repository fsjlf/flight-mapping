namespace FlightMapping.Api.Configuration;

public class SabreOptions
{
    public const string SectionName = "Sabre";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string GroupId { get; set; } = string.Empty;

    /// <summary>
    /// "Test" or "Production". Controls which Sabre environment is targeted.
    /// </summary>
    public string Environment { get; set; } = "Test";

    public string BaseUrl => Environment?.Equals("Production", StringComparison.OrdinalIgnoreCase) == true
        ? "https://api.platform.sabre.com"
        : "https://api.test.sabre.com";

    public string TokenEndpoint => $"{BaseUrl}/v2/auth/token";
}
