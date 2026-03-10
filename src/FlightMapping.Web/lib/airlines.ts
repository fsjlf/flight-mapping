// Airline name → IATA carrier code mapping
// Keys are lowercase for case-insensitive matching
const AIRLINES: Record<string, string> = {
  // US carriers
  "united": "UA", "united airlines": "UA", ua: "UA",
  "american": "AA", "american airlines": "AA", aa: "AA",
  "delta": "DL", "delta air lines": "DL", "delta airlines": "DL", dl: "DL",
  "southwest": "WN", "southwest airlines": "WN", wn: "WN",
  "jetblue": "B6", "jet blue": "B6", b6: "B6",
  "alaska": "AS", "alaska airlines": "AS", as: "AS",
  "spirit": "NK", "spirit airlines": "NK", nk: "NK",
  "frontier": "F9", "frontier airlines": "F9", f9: "F9",
  "hawaiian": "HA", "hawaiian airlines": "HA", ha: "HA",
  "sun country": "SY", sy: "SY",

  // European carriers
  "lufthansa": "LH", lh: "LH",
  "british airways": "BA", "british": "BA", ba: "BA",
  "air france": "AF", af: "AF",
  "klm": "KL", "klm royal dutch": "KL", kl: "KL",
  "swiss": "LX", "swiss air": "LX", "swiss international": "LX", lx: "LX",
  "iberia": "IB", ib: "IB",
  "aer lingus": "EI", "aerlingus": "EI", ei: "EI",
  "ryanair": "FR", fr: "FR",
  "easyjet": "U2", u2: "U2",
  "norwegian": "DY", "norwegian air": "DY", dy: "DY",
  "sas": "SK", "scandinavian": "SK", "scandinavian airlines": "SK", sk: "SK",
  "finnair": "AY", ay: "AY",
  "tap": "TP", "tap portugal": "TP", "tap air portugal": "TP", tp: "TP",
  "turkish": "TK", "turkish airlines": "TK", tk: "TK",
  "virgin atlantic": "VS", "virgin": "VS", vs: "VS",
  "icelandair": "FI", fi: "FI",
  "lot": "LO", "lot polish": "LO", lo: "LO",
  "austrian": "OS", "austrian airlines": "OS", os: "OS",
  "brussels airlines": "SN", sn: "SN",
  "eurowings": "EW", ew: "EW",
  "condor": "DE", de: "DE",

  // Middle Eastern carriers
  "emirates": "EK", ek: "EK",
  "qatar": "QR", "qatar airways": "QR", qr: "QR",
  "etihad": "EY", "etihad airways": "EY", ey: "EY",
  "saudia": "SV", "saudi arabian": "SV", sv: "SV",
  "royal jordanian": "RJ", rj: "RJ",
  "oman air": "WY", wy: "WY",
  "gulf air": "GF", gf: "GF",

  // Asian carriers
  "singapore airlines": "SQ", "singapore": "SQ", sq: "SQ",
  "cathay": "CX", "cathay pacific": "CX", cx: "CX",
  "japan airlines": "JL", "jal": "JL", jl: "JL",
  "ana": "NH", "all nippon": "NH", "all nippon airways": "NH", nh: "NH",
  "korean air": "KE", "korean": "KE", ke: "KE",
  "asiana": "OZ", oz: "OZ",
  "thai": "TG", "thai airways": "TG", tg: "TG",
  "eva air": "BR", "eva": "BR", br: "BR",
  "china airlines": "CI", ci: "CI",
  "china eastern": "MU", mu: "MU",
  "china southern": "CZ", cz: "CZ",
  "air china": "CA", ca: "CA",
  "garuda": "GA", "garuda indonesia": "GA", ga: "GA",
  "vietnam airlines": "VN", vn: "VN",
  "philippine airlines": "PR", "philippine": "PR", pr: "PR",
  "air india": "AI", ai: "AI",
  "malaysia airlines": "MH", "malaysia": "MH", mh: "MH",
  "cebu pacific": "5J",
  "scoot": "TR", tr: "TR",

  // Oceania
  "qantas": "QF", qf: "QF",
  "air new zealand": "NZ", nz: "NZ",
  "jetstar": "JQ", jq: "JQ",

  // South American carriers
  "latam": "LA", la: "LA",
  "avianca": "AV", av: "AV",
  "gol": "G3", g3: "G3",
  "azul": "AD", ad: "AD",
  "copa": "CM", "copa airlines": "CM", cm: "CM",

  // African carriers
  "ethiopian": "ET", "ethiopian airlines": "ET", et: "ET",
  "south african": "SA", "south african airways": "SA",
  "kenya airways": "KQ", kq: "KQ",
  "royal air maroc": "AT", at: "AT",
  "egyptair": "MS", ms: "MS",

  // Canadian carriers
  "air canada": "AC", ac: "AC",
  "westjet": "WS", ws: "WS",
};

// Sorted by name length descending so longer matches are tried first
const AIRLINE_NAMES = Object.keys(AIRLINES)
  .filter((k) => k.length > 2) // Skip 2-letter IATA codes for pattern matching
  .sort((a, b) => b.length - a.length);

/**
 * Resolve an airline name/code to its IATA carrier code.
 */
export function resolveCarrier(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (AIRLINES[normalized]) return AIRLINES[normalized];
  // If it's already a 2-letter IATA code (uppercase check)
  if (/^[A-Z]{2}$/.test(input.trim())) return input.trim();
  return null;
}

/**
 * Extract all carrier references from a text string.
 * Returns an array of IATA carrier codes.
 */
export function extractCarriers(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const name of AIRLINE_NAMES) {
    // Use word boundary matching to avoid false positives
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(lower)) {
      found.add(AIRLINES[name]);
    }
  }

  return [...found];
}
