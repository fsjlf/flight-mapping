// City/airport name → IATA code mapping
// Keys are lowercase for case-insensitive matching
const AIRPORTS: Record<string, string> = {
  // North America
  "new york": "JFK", nyc: "JFK", jfk: "JFK", "john f kennedy": "JFK",
  newark: "EWR", ewr: "EWR", laguardia: "LGA", lga: "LGA",
  "los angeles": "LAX", la: "LAX", lax: "LAX",
  chicago: "ORD", ord: "ORD", "o'hare": "ORD", ohare: "ORD", mdw: "MDW", midway: "MDW",
  "san francisco": "SFO", sfo: "SFO",
  dallas: "DFW", dfw: "DFW", "fort worth": "DFW",
  miami: "MIA", mia: "MIA",
  atlanta: "ATL", atl: "ATL",
  boston: "BOS", bos: "BOS",
  seattle: "SEA", sea: "SEA",
  denver: "DEN", den: "DEN",
  houston: "IAH", iah: "IAH",
  phoenix: "PHX", phx: "PHX",
  "las vegas": "LAS", vegas: "LAS", las: "LAS",
  orlando: "MCO", mco: "MCO",
  "washington": "IAD", "washington dc": "IAD", dc: "DCA", iad: "IAD", dca: "DCA",
  philadelphia: "PHL", phl: "PHL",
  minneapolis: "MSP", msp: "MSP",
  detroit: "DTW", dtw: "DTW",
  "salt lake city": "SLC", slc: "SLC",
  "san diego": "SAN", san: "SAN",
  charlotte: "CLT", clt: "CLT",
  portland: "PDX", pdx: "PDX",
  austin: "AUS", aus: "AUS",
  nashville: "BNA", bna: "BNA",
  tampa: "TPA", tpa: "TPA",
  toronto: "YYZ", yyz: "YYZ",
  montreal: "YUL", yul: "YUL",
  vancouver: "YVR", yvr: "YVR",
  "mexico city": "MEX", mex: "MEX",
  cancun: "CUN", cun: "CUN",
  honolulu: "HNL", hnl: "HNL", hawaii: "HNL",

  // Europe
  london: "LHR", lon: "LON", lhr: "LHR", heathrow: "LHR",
  gatwick: "LGW", lgw: "LGW", stansted: "STN",
  paris: "CDG", par: "PAR", cdg: "CDG", "charles de gaulle": "CDG", orly: "ORY",
  amsterdam: "AMS", ams: "AMS",
  frankfurt: "FRA", fra: "FRA",
  munich: "MUC", muc: "MUC",
  berlin: "BER", ber: "BER",
  rome: "FCO", fco: "FCO", fiumicino: "FCO",
  milan: "MXP", mxp: "MXP", malpensa: "MXP",
  madrid: "MAD", mad: "MAD",
  barcelona: "BCN", bcn: "BCN",
  lisbon: "LIS", lis: "LIS",
  dublin: "DUB", dub: "DUB",
  zurich: "ZRH", zrh: "ZRH",
  vienna: "VIE", vie: "VIE",
  copenhagen: "CPH", cph: "CPH",
  stockholm: "ARN", arn: "ARN",
  oslo: "OSL", osl: "OSL",
  helsinki: "HEL", hel: "HEL",
  brussels: "BRU", bru: "BRU",
  athens: "ATH", ath: "ATH",
  istanbul: "IST", ist: "IST",
  moscow: "SVO", svo: "SVO",
  prague: "PRG", prg: "PRG",
  budapest: "BUD", bud: "BUD",
  warsaw: "WAW", waw: "WAW",
  edinburgh: "EDI", edi: "EDI",
  manchester: "MAN", man: "MAN",
  nice: "NCE", nce: "NCE",
  geneva: "GVA", gva: "GVA",

  // Asia
  tokyo: "NRT", nrt: "NRT", narita: "NRT", haneda: "HND", hnd: "HND",
  osaka: "KIX", kix: "KIX",
  beijing: "PEK", pek: "PEK",
  shanghai: "PVG", pvg: "PVG",
  "hong kong": "HKG", hkg: "HKG",
  singapore: "SIN", sin: "SIN",
  bangkok: "BKK", bkk: "BKK",
  seoul: "ICN", icn: "ICN", incheon: "ICN",
  taipei: "TPE", tpe: "TPE",
  delhi: "DEL", del: "DEL", "new delhi": "DEL",
  mumbai: "BOM", bom: "BOM",
  dubai: "DXB", dxb: "DXB",
  "abu dhabi": "AUH", auh: "AUH",
  doha: "DOH", doh: "DOH",
  "tel aviv": "TLV", tlv: "TLV",
  "kuala lumpur": "KUL", kul: "KUL",
  manila: "MNL", mnl: "MNL",
  jakarta: "CGK", cgk: "CGK",
  hanoi: "HAN", han: "HAN",
  "ho chi minh": "SGN", saigon: "SGN", sgn: "SGN",

  // Oceania
  sydney: "SYD", syd: "SYD",
  melbourne: "MEL", mel: "MEL",
  auckland: "AKL", akl: "AKL",

  // South America
  "sao paulo": "GRU", gru: "GRU",
  "rio de janeiro": "GIG", rio: "GIG", gig: "GIG",
  "buenos aires": "EZE", eze: "EZE",
  lima: "LIM", lim: "LIM",
  bogota: "BOG", bog: "BOG",
  santiago: "SCL", scl: "SCL",

  // Africa
  johannesburg: "JNB", jnb: "JNB",
  cairo: "CAI", cai: "CAI",
  nairobi: "NBO", nbo: "NBO",
  "cape town": "CPT", cpt: "CPT",
  casablanca: "CMN", cmn: "CMN",

  // Additional destinations
  bali: "DPS", dps: "DPS", denpasar: "DPS",
  "london heathrow": "LHR",
  "london gatwick": "LGW",
  "london stansted": "STN",
  "new york jfk": "JFK",
  "new york laguardia": "LGA",
  "new york newark": "EWR",
};

export function resolveAirport(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  // Direct lookup
  if (AIRPORTS[normalized]) return AIRPORTS[normalized];
  // If it's already a 3-letter IATA code (uppercase check)
  if (/^[A-Z]{3}$/.test(input.trim())) return input.trim();
  // Try matching by starting substring — require minimum 3 chars to prevent
  // false positives like "me"→MEX, "I"→IAH, "to"→YYZ, "or"→ORD
  if (normalized.length >= 3) {
    for (const [key, code] of Object.entries(AIRPORTS)) {
      if (key.startsWith(normalized)) return code;
      // "input starts with key" — only match at word boundaries
      if (normalized.startsWith(key) && (normalized.length === key.length || normalized[key.length] === " ")) return code;
    }
  }
  return null;
}
