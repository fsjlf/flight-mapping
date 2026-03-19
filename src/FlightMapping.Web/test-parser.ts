import { parseNaturalLanguage } from "./lib/parser";

const samples = [
  `Chicago to London, March 20th, United or Lufthansa, morning departure, economy.`,
  `I need to get from New York to Tokyo on April 5th — business class out, economy back on April 14th. One stop is fine.`,
  `Can you find me a cheap flight from LAX to Miami on March 15th? Doesn't matter which airline.`,
  `Looking for nonstop options from SFO to Paris on May 3rd, business class both ways, prefer Air France.`,
  `Flying Dallas to Amsterdam on June 12th, returning June 19th. Economy, just want the cheapest option.`,
  `Need to be in Boston by 9am on March 18th, flying out of DC. Any carrier, economy is fine.`,
  `Round trip, Denver to Cancun, February 14th to February 21st, two adults. Prefer direct but will do one stop. Economy.`,
  `What are my options from Seattle to Dubai departing November 28th? I want business class on the way there at least.`,
  `Flying solo, JFK to Rome, March 29th returning April 6th, economy, no strong carrier preference.`,
  `Get me to Singapore from Houston on May 1st — business class, preferably Singapore Airlines or Cathay.`,
  `I need a one-way from Atlanta to LA on April 10th, first thing in the morning, any airline.`,
  `Toronto to Sydney, July 4th outbound, July 18th return. Business both ways, open to any carrier with a flat bed.`,
  `Looking for the earliest possible flight from Miami to Chicago on March 22nd, economy, doesn't matter who.`,
  `Flying from Phoenix to London Heathrow on June 1st, back June 10th. Economy out, but I'd love business or premium economy coming home.`,
  `One way from Boston to Dublin, April 30th, morning or early afternoon departure. Aer Lingus preferred.`,
  `Need flights for two from LAX to Bali — outbound April 20th, return May 5th. Economy, willing to do two stops if it's significantly cheaper.`,
  `Can you check what Delta has from Atlanta to Paris on May 17th? Business class, one way.`,
  `Washington DC to Mumbai, departing March 31st, returning April 14th. Economy on the way out, business on the return.`,
  `Quickest way to get from Minneapolis to London on July 9th, don't care about the airline, business class.`,
  // Bonus: compact date range
  `March 20-30 New York to London`,
  `SFO to Tokyo March 15-28, business class`,
];

console.log("=".repeat(100));
console.log("PARSER TEST — 20 SAMPLES");
console.log("=".repeat(100));

let pass = 0;
let fail = 0;

for (let i = 0; i < samples.length; i++) {
  const result = parseNaturalLanguage(samples[i]);
  const segs = result.request.segments ?? [];
  const prefs = result.request.preferences;
  const pax = result.request.passengers;
  const { carriers, maxStops, priority, notes } = result.parsed;

  const hasSegments = segs.length > 0;
  const hasOrigin = segs.length > 0 && segs[0].origins?.[0]?.length === 3;
  const hasDest = segs.length > 0 && segs[0].destinations?.[0]?.length === 3;
  const hasDate = segs.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(segs[0].departureDate);

  const ok = hasSegments && hasOrigin && hasDest && hasDate;
  if (ok) pass++;
  else fail++;

  console.log(`\n${ok ? "✅" : "❌"} Sample ${i + 1}: ${samples[i].substring(0, 70)}...`);
  console.log(`   Segments: ${segs.length}`);
  for (const s of segs) {
    console.log(`     ${s.origins.join(",")} → ${s.destinations.join(",")} on ${s.departureDate}${s.cabinOverride ? ` [${s.cabinOverride}]` : ""}${s.timePreference ? ` (${s.timePreference})` : ""}`);
  }
  console.log(`   Passengers: ${pax?.adults}A ${pax?.children}C ${pax?.infants}I`);
  if (prefs?.cabin) console.log(`   Default cabin: ${prefs.cabin}`);
  if (carriers.length) console.log(`   Carriers: ${carriers.join(", ")}`);
  if (maxStops !== null) console.log(`   Max stops: ${maxStops}`);
  if (priority) console.log(`   Priority: ${priority}`);
  if (notes.length) console.log(`   Notes: ${notes.join("; ")}`);
  if (result.warnings.length) console.log(`   ⚠️ Warnings: ${result.warnings.join("; ")}`);
}

console.log(`\n${"=".repeat(100)}`);
console.log(`RESULTS: ${pass}/${samples.length} passed, ${fail}/${samples.length} failed`);
console.log("=".repeat(100));
