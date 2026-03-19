namespace FlightMapping.Api.Extensions;

using FlightMapping.Api.Configuration;
using FlightMapping.Api.Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSabreIntegration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<SabreOptions>(configuration.GetSection(SabreOptions.SectionName));
        services.AddMemoryCache();
        services.AddSingleton<ISabreTokenService, SabreTokenService>();
        services.AddTransient<SabreAuthHandler>();

        // Plain client for token acquisition (no auth handler — avoids circular dependency)
        services.AddHttpClient("SabreAuth");

        // Typed client for Sabre API calls (auth handler auto-injects Bearer token)
        services.AddHttpClient<ISabreClient, SabreClient>((sp, client) =>
            {
                var options = configuration.GetSection(SabreOptions.SectionName).Get<SabreOptions>()!;
                client.BaseAddress = new Uri(options.BaseUrl);
                client.DefaultRequestHeaders.Add("Accept", "application/json");
            })
            .AddHttpMessageHandler<SabreAuthHandler>();

        return services;
    }

    public static IServiceCollection AddFlightSearch(this IServiceCollection services)
    {
        services.AddSingleton<IRouteExpander, RouteExpander>();
        services.AddSingleton<ITripClassifier, TripClassifier>();
        services.AddSingleton<IStrategyGenerator, StrategyGenerator>();
        services.AddSingleton<IBfmRequestBuilder, BfmRequestBuilder>();
        services.AddSingleton<IBfmResponseParser, BfmResponseParser>();
        services.AddSingleton<IResultEnricher, ResultEnricher>();
        services.AddSingleton<IItineraryScorer, ItineraryScorer>();
        services.AddScoped<ISearchOrchestrator, SearchOrchestrator>();

        // Split PNR services
        services.AddSingleton<IWaterfallCalculator, WaterfallCalculator>();
        services.AddSingleton<ISplitPnrDetector, SplitPnrDetector>();
        services.AddSingleton<ISplitPnrAnalyzer, SplitPnrAnalyzer>();

        return services;
    }
}
