using System.Text.Json.Serialization;
using DotNetEnv;
using FlightMapping.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Load .env file (no-op if missing — Doppler/env vars take over in production)
Env.Load(Path.Combine(builder.Environment.ContentRootPath, ".env"));

// Map flat env var names (matching Doppler) to .NET config hierarchy
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Sabre:ClientId"] = Environment.GetEnvironmentVariable("SABRE_CLIENT_ID"),
    ["Sabre:ClientSecret"] = Environment.GetEnvironmentVariable("SABRE_CLIENT_SECRET"),
    ["Sabre:GroupId"] = Environment.GetEnvironmentVariable("SABRE_GROUP_ID"),
    ["Sabre:Environment"] = Environment.GetEnvironmentVariable("SABRE_ENVIRONMENT"),
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddSabreIntegration(builder.Configuration);
builder.Services.AddFlightSearch();

var app = builder.Build();

app.UseCors();
app.MapControllers();

app.Run();
