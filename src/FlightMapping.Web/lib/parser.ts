import { CabinClass, DepartureTimeWindow, SearchPriority, SearchRequest, SegmentInput } from "./types";
import { resolveAirport } from "./airports";
import { extractCarriers } from "./airlines";

export interface ParsedSegment {
  origin: string;
  destination: string;
  date: string;
  raw: string;
  cabin?: CabinClass;
  time?: DepartureTimeWindow;
}

export interface ParseResult {
  request: Partial<SearchRequest>;
  parsed: {
    segments: ParsedSegment[];
    adults: number;
    children: number;
    infants: number;
    cabin: CabinClass | null;
    carriers: string[];
    maxStops: number | null;
    priority: SearchPriority | null;
    notes: string[];
  };
  warnings: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

export function parseNaturalLanguage(input: string): ParseResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  // Normalize
  const text = input.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // Extract metadata
  const cabin = extractGlobalCabin(text);
  const { adults, children, infants } = extractPassengers(text);
  const carriers = extractCarriers(text);
  const maxStops = extractMaxStops(text);
  const priority = extractPriority(text);

  // Extract conditional/aspirational notes
  extractNotes(text, notes);

  // Extract segments
  const segments = extractSegments(text);

  // Apply per-segment cabin overrides from directional context
  applyDirectionalCabinOverrides(text, segments, cabin);

  // Resolve IATA codes and build SegmentInput[]
  const resolvedSegments: SegmentInput[] = [];
  for (const seg of segments) {
    const origin = resolveAirport(seg.origin);
    const dest = resolveAirport(seg.destination);
    if (!origin) warnings.push(`Could not resolve airport: "${seg.origin}"`);
    if (!dest) warnings.push(`Could not resolve airport: "${seg.destination}"`);
    if (origin && dest && seg.date) {
      const resolved: SegmentInput = {
        origin,
        destination: dest,
        departureDate: seg.date,
      };
      if (seg.cabin) resolved.cabinOverride = seg.cabin;
      if (seg.time) resolved.timePreference = seg.time;
      resolvedSegments.push(resolved);
    }
  }

  return {
    request: {
      segments: resolvedSegments,
      passengers: { adults, children, infants, infantsWithSeat: 0 },
      preferences: {
        ...(cabin ? { cabin } : {}),
        ...(carriers.length > 0 ? { preferredCarriers: carriers } : {}),
        ...(maxStops !== null ? { maxStops } : {}),
        ...(priority ? { priority } : {}),
      },
    },
    parsed: { segments, adults, children, infants, cabin, carriers, maxStops, priority, notes },
    warnings,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Segment extraction — the core logic
// ────────────────────────────────────────────────────────────────────────────

function extractSegments(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Phase 1: Try to find a primary route (origin → destination) with dates
  const route = extractRoute(text);
  if (!route) return segments;

  const { origin, destination } = route;

  // Phase 2: Extract dates
  const dates = extractAllDates(text);
  const outboundDate = dates.outbound;
  const returnDate = dates.return;

  // Phase 3: Determine time preferences
  const outboundTime = extractDirectionalTime(text, "outbound") ?? extractClauseTime(text);
  const returnTime = extractDirectionalTime(text, "return");

  // Build outbound segment
  if (outboundDate) {
    segments.push({
      origin,
      destination,
      date: outboundDate,
      raw: text,
      time: outboundTime,
    });
  }

  // Build return segment if we have a return date
  if (returnDate) {
    segments.push({
      origin: destination,
      destination: origin,
      date: returnDate,
      raw: text,
      time: returnTime,
    });
  }

  return segments;
}

// ────────────────────────────────────────────────────────────────────────────
// Route extraction — find origin and destination
// ────────────────────────────────────────────────────────────────────────────

function extractRoute(text: string): { origin: string; destination: string } | null {
  // Strip out airline names and cabin/class phrases to avoid them polluting city extraction
  let cleaned = stripCarrierNames(text);
  cleaned = stripCabinPhrases(cleaned);
  cleaned = stripNoisePhrases(cleaned);

  // Pattern 1: "from X to Y" / "X to Y"
  const fromTo = cleaned.match(
    /(?:from\s+)(.+?)\s+(?:to|-+>?|=>)\s+(.+?)(?:\s+(?:on|by|departing|leaving|outbound|returning|round\s*trip|one[- ]?way|,|—|-{2,}|\d)|\s*$)/i
  );
  if (fromTo) {
    const o = cleanCityName(fromTo[1]);
    const d = cleanCityName(fromTo[2]);
    if (o && d && resolveAirport(o) && resolveAirport(d)) return { origin: o, destination: d };
  }

  // Pattern 2: "get me to Y from X" / "flying to Y from X"
  const toFrom = cleaned.match(
    /(?:get\s+me\s+to|fly(?:ing)?\s+to|need\s+to\s+(?:get|be)\s+(?:to|in))\s+(.+?)\s+from\s+(.+?)(?:\s+(?:on|by|departing|,|—|-{2,}|\d)|\s*$)/i
  );
  if (toFrom) {
    const o = cleanCityName(toFrom[2]);
    const d = cleanCityName(toFrom[1]);
    if (o && d && resolveAirport(o) && resolveAirport(d)) return { origin: o, destination: d };
  }

  // Pattern 3: "flying (out of|from) X to Y" — more flexible
  const flyFrom = cleaned.match(
    /(?:fly(?:ing)?|depart(?:ing)?)\s+(?:out\s+of|from)\s+(.+?)(?:\s+to\s+(.+?))?(?:\s+(?:on|by|,|—|-{2,}|\d)|\s*$)/i
  );
  if (flyFrom && flyFrom[2]) {
    const o = cleanCityName(flyFrom[1]);
    const d = cleanCityName(flyFrom[2]);
    if (o && d && resolveAirport(o) && resolveAirport(d)) return { origin: o, destination: d };
  }

  // Pattern 4: "need to be in Y by TIME, flying out of X"
  const needIn = cleaned.match(
    /(?:need\s+to\s+be\s+in|arrive\s+(?:in|at))\s+(.+?)\s+(?:by|before|at)\s+.+?(?:flying|from|out\s+of)\s+(.+?)(?:\s*[,.]|\s*$)/i
  );
  if (needIn) {
    const o = cleanCityName(needIn[2]);
    const d = cleanCityName(needIn[1]);
    if (o && d && resolveAirport(o) && resolveAirport(d)) return { origin: o, destination: d };
  }

  // Pattern 5: Broader "from X to Y" allowing dates between
  const broadFromTo = cleaned.match(
    /(?:from\s+)?(.+?)\s+(?:to|-+>?|=>)\s+(.+?)(?:\s|,|$)/i
  );
  if (broadFromTo) {
    const o = cleanCityName(broadFromTo[1]);
    const d = cleanCityName(broadFromTo[2]);
    if (o && d && resolveAirport(o) && resolveAirport(d)) return { origin: o, destination: d };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Date extraction
// ────────────────────────────────────────────────────────────────────────────

interface DatePair {
  outbound: string | null;
  return: string | null;
}

function extractAllDates(text: string): DatePair {
  // Strategy: find all date-like tokens, then determine which is outbound vs return

  // First, check for explicit return date markers
  const returnDateMatch = text.match(
    /(?:return(?:ing)?|back|inbound|coming\s+(?:back|home))\s+(?:on\s+)?(?:the\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );

  // Check for explicit outbound date markers
  const outboundDateMatch = text.match(
    /(?:depart(?:ing)?|outbound|leaving|on)\s+(?:the\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );

  // Check for date range patterns: "DATE to DATE" or "DATE - DATE" or "DATE through DATE"
  const dateRangePattern =
    /(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:to|through|thru|-|–|—)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;

  const rangeMatch = text.match(dateRangePattern);

  // If we have an explicit range like "February 14th to February 21st"
  if (rangeMatch) {
    // Make sure this isn't a city "to" city pattern by checking if both parts parse as dates
    const d1 = parseDate(rangeMatch[1]);
    const d2 = parseDate(rangeMatch[2]);
    if (d1 && d2) {
      return { outbound: d1, return: d2 };
    }
  }

  // Try explicit markers
  let outbound: string | null = null;
  let returnDate: string | null = null;

  if (returnDateMatch) {
    returnDate = parseDate(returnDateMatch[1]);
  }

  if (outboundDateMatch) {
    outbound = parseDate(outboundDateMatch[1]);
  }

  // Collect all date tokens from the text
  const allDates = findAllDateTokens(text);

  if (!outbound && allDates.length > 0) {
    outbound = allDates[0];
  }

  if (!returnDate && allDates.length > 1) {
    // Second date is return, unless it was already used as outbound
    const candidate = allDates[1];
    if (candidate !== outbound) {
      returnDate = candidate;
    }
  }

  // If the text indicates round-trip but we only found one date, there's no return date
  return { outbound, return: returnDate };
}

function findAllDateTokens(text: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // Match various date formats in order of appearance
  const datePatterns = [
    // ISO: 2026-03-20
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    // Month DD[th] [YYYY]: March 20th, March 20 2026
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)\b/gi,
    // MM/DD or MM/DD/YYYY
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g,
  ];

  for (const pattern of datePatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const parsed = parseDate(m[1]);
      if (parsed && !seen.has(parsed)) {
        seen.add(parsed);
        results.push(parsed);
      }
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Directional cabin overrides ("business out, economy back")
// ────────────────────────────────────────────────────────────────────────────

function applyDirectionalCabinOverrides(
  text: string,
  segments: ParsedSegment[],
  globalCabin: CabinClass | null
): void {
  if (segments.length < 1) return;

  const lower = text.toLowerCase();

  // Patterns like "business class out, economy back"
  // or "economy on the way out, business on the return"
  const outCabin = extractDirectionalCabin(lower, "outbound");
  const retCabin = extractDirectionalCabin(lower, "return");

  if (outCabin && segments[0]) {
    segments[0].cabin = outCabin;
  }
  if (retCabin && segments.length > 1 && segments[1]) {
    segments[1].cabin = retCabin;
  }

  // If only a global cabin was found and no directional overrides, apply it as default
  if (globalCabin && !outCabin && !retCabin) {
    for (const seg of segments) {
      if (!seg.cabin) seg.cabin = globalCabin;
    }
  }
}

function extractDirectionalCabin(lower: string, direction: "outbound" | "return"): CabinClass | null {
  const cabinWords = "(first\\s*class|business\\s*class|premium\\s*economy|economy|business|first)";

  let patterns: RegExp[];
  if (direction === "outbound") {
    patterns = [
      new RegExp(`${cabinWords}\\s+(?:out(?:bound)?|on\\s+the\\s+way\\s+(?:there|out)|going|departing)`, "i"),
      new RegExp(`${cabinWords}\\s+(?:class\\s+)?(?:out(?:bound)?|on\\s+the\\s+way\\s+(?:there|out))`, "i"),
      new RegExp(`(?:out(?:bound)?|on\\s+the\\s+way\\s+(?:there|out)|going)\\s*[,:]?\\s*${cabinWords}`, "i"),
    ];
  } else {
    patterns = [
      new RegExp(`${cabinWords}\\s+(?:back|return(?:ing)?|home(?:bound)?|coming\\s+(?:back|home)|on\\s+the\\s+(?:way\\s+)?(?:back|return))`, "i"),
      new RegExp(`(?:back|return(?:ing)?|home(?:bound)?|coming\\s+(?:back|home)|on\\s+the\\s+(?:way\\s+)?(?:back|return))\\s*[,:]?\\s*${cabinWords}`, "i"),
    ];
  }

  for (const pattern of patterns) {
    const m = lower.match(pattern);
    if (m) {
      // Find the cabin capture group
      for (let i = 1; i <= m.length; i++) {
        if (m[i]) return parseCabinWord(m[i]);
      }
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Directional time extraction
// ────────────────────────────────────────────────────────────────────────────

function extractDirectionalTime(text: string, direction: "outbound" | "return"): DepartureTimeWindow | undefined {
  const lower = text.toLowerCase();
  const timeWords = "(morning|afternoon|evening|red[- ]?eye|overnight|late[- ]?night|early|earliest|first\\s+thing)";

  if (direction === "outbound") {
    const m = lower.match(new RegExp(`${timeWords}\\s+(?:departure|flight|out(?:bound)?)`, "i"));
    if (m) return parseTimeWord(m[1]);
  } else {
    const m = lower.match(new RegExp(`${timeWords}\\s+(?:return|back|home)`, "i"));
    if (m) return parseTimeWord(m[1]);
  }
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Global metadata extraction
// ────────────────────────────────────────────────────────────────────────────

function extractGlobalCabin(text: string): CabinClass | null {
  // Find the LAST cabin mention that isn't directional, as overall default
  const cabinMatch = text.match(
    /\b(first\s*class|business\s*class|premium\s*economy|economy|business|first)\b/gi
  );
  if (!cabinMatch) return null;

  // Use the first non-directional one as global default
  const lower = text.toLowerCase();
  for (const match of cabinMatch) {
    const idx = lower.indexOf(match.toLowerCase());
    const surrounding = lower.substring(Math.max(0, idx - 30), Math.min(lower.length, idx + match.length + 30));
    // Skip if it's clearly directional
    if (/\b(out|back|return|there|home|going|coming)\b/.test(surrounding)) continue;
    return parseCabinWord(match);
  }
  // If all mentions are directional, use first one as fallback
  return parseCabinWord(cabinMatch[0]);
}

function extractPassengers(text: string): { adults: number; children: number; infants: number } {
  let adults = 1;
  let children = 0;
  let infants = 0;

  // Explicit count: "2 adults", "3 adults"
  const adultMatch = text.match(/(\d+)\s*adults?/i);
  if (adultMatch) adults = parseInt(adultMatch[1]);

  // "two adults", "three adults"
  const wordAdults = text.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+adults?\b/i);
  if (wordAdults) adults = wordToNumber(wordAdults[1]);

  // "for two" / "for 2" (without "adults" — assume adults)
  if (!adultMatch && !wordAdults) {
    const forN = text.match(/\b(?:for|flights?\s+for)\s+(\d+|two|three|four|five)\b/i);
    if (forN) adults = typeof forN[1] === "string" && /\D/.test(forN[1]) ? wordToNumber(forN[1]) : parseInt(forN[1]);
  }

  // "flying solo" = 1 adult
  if (/\bflying\s+solo\b/i.test(text)) adults = 1;

  // Children
  const childMatch = text.match(/(\d+)\s*(?:children|child|kids?)/i);
  if (childMatch) children = parseInt(childMatch[1]);

  // Infants
  const infantMatch = text.match(/(\d+)\s*infants?/i);
  if (infantMatch) infants = parseInt(infantMatch[1]);

  return { adults, children, infants };
}

function extractMaxStops(text: string): number | null {
  const lower = text.toLowerCase();

  if (/\b(?:non[- ]?stop|nonstop|direct)\b/i.test(lower)) return 0;
  const stopsMatch = lower.match(/\b(?:(?:up\s+to\s+)?(\d+|one|two|three)\s+stop|(\d+|one|two|three)[- ]stop)/i);
  if (stopsMatch) {
    const val = stopsMatch[1] || stopsMatch[2];
    return /\d/.test(val) ? parseInt(val) : wordToNumber(val);
  }
  // "one stop is fine" / "will do one stop"
  if (/\bone\s+stop\b/i.test(lower)) return 1;
  if (/\btwo\s+stops?\b/i.test(lower)) return 2;
  return null;
}

function extractPriority(text: string): SearchPriority | null {
  const lower = text.toLowerCase();
  if (/\b(?:cheap(?:est)?|lowest\s*(?:price|fare|cost)|budget|want\s+the\s+cheapest)\b/i.test(lower)) return "Price";
  if (/\b(?:quick(?:est)?|fast(?:est)?|shortest|least\s+time)\b/i.test(lower)) return "Duration";
  if (/\b(?:comfort(?:able)?|flat\s*bed|lie[- ]?flat|luxury)\b/i.test(lower)) return "Comfort";
  return null;
}

function extractNotes(text: string, notes: string[]): void {
  // Conditional upgrade preferences
  if (/\b(?:i'?d\s+upgrade|would\s+upgrade|open\s+to\s+upgrading?|willing\s+to\s+upgrade)\b/i.test(text)) {
    const upgradeMatch = text.match(
      /(?:i'?d\s+upgrade|would\s+upgrade|open\s+to\s+upgrading?|willing\s+to\s+upgrade)\s+(?:to\s+)?(.+?)(?:\s+if\b|$)/i
    );
    if (upgradeMatch) {
      notes.push(`Conditional upgrade interest: ${upgradeMatch[0].trim()}`);
    }
  }

  // Arrival time constraint
  const arrivalMatch = text.match(
    /\b(?:(?:need\s+to\s+)?be\s+(?:there|in\s+\w+)\s+by|arrive\s+(?:by|before))\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (arrivalMatch) {
    notes.push(`Arrival constraint: by ${arrivalMatch[1]}`);
  }

  // Stop flexibility
  if (/\bwilling\s+to\s+do\s+(?:one|two|\d+)\s+stops?\b/i.test(text)) {
    const m = text.match(/willing\s+to\s+do\s+(one|two|\d+)\s+stops?\s*(.*?)(?:\.|$)/i);
    if (m) notes.push(`Stop flexibility: ${m[0].trim()}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────────────────────

function parseCabinWord(raw: string): CabinClass {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("first")) return "First";
  if (lower.includes("business")) return "Business";
  if (lower.includes("premium")) return "PremiumEconomy";
  return "Economy";
}

function parseTimeWord(raw: string): DepartureTimeWindow {
  const lower = raw.toLowerCase().trim();
  if (/red[- ]?eye|overnight|late[- ]?night/.test(lower)) return "RedEye";
  if (/evening/.test(lower)) return "Evening";
  if (/afternoon|early\s+afternoon/.test(lower)) return "Afternoon";
  if (/morning|early|earliest|first\s+thing/.test(lower)) return "Morning";
  return "Any";
}

function extractClauseTime(clause: string): DepartureTimeWindow | undefined {
  const lower = clause.toLowerCase();
  if (/\b(?:red[- ]?eye|overnight|late[- ]?night)\b/.test(lower)) return "RedEye";
  if (/\bevening\b/.test(lower)) return "Evening";
  if (/\b(?:early\s+afternoon|afternoon)\b/.test(lower)) return "Afternoon";
  if (/\b(?:morning|first\s+thing|earliest(?:\s+possible)?|early)\b/.test(lower)) return "Morning";
  return undefined;
}

function cleanCityName(raw: string): string {
  return raw
    .replace(/\b(?:on|by|departing|from|the|flying|out\s+of|into|leaving|arriving|in)\b/gi, "")
    .replace(/\b(?:first\s*class|business\s*class|premium\s*economy|economy|business|first)\b/gi, "")
    .replace(/\b(?:morning|afternoon|evening|red[- ]?eye|overnight|late[- ]?night)\b/gi, "")
    .replace(/\b(?:nonstop|non[- ]?stop|direct|one[- ]?way|round[- ]?trip)\b/gi, "")
    .replace(/[,;—–\-]+$/g, "")
    .replace(/^[,;—–\-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCarrierNames(text: string): string {
  // Remove carrier references from text to prevent them interfering with route parsing
  let result = text;
  // Remove "on/with/via CARRIER" phrases
  result = result.replace(
    /\b(?:on|with|via|prefer(?:ably)?|preferr?ed?)\s+(?:carrier\s+)?(?:[\w\s]+?(?:airlines?|air(?:ways|lines)?|pacific))\b/gi,
    " "
  );
  // Remove "CARRIER or CARRIER" patterns
  result = result.replace(
    /\b(?:[\w]+(?:\s+airlines?|\s+air(?:ways)?|\s+pacific)?)\s+or\s+(?:[\w]+(?:\s+airlines?|\s+air(?:ways)?|\s+pacific)?)\b/gi,
    " "
  );
  return result.replace(/\s+/g, " ");
}

function stripCabinPhrases(text: string): string {
  return text
    .replace(/\b(?:first\s*class|business\s*class|premium\s*economy|economy\s*class|economy|business|first)\b/gi, " ")
    .replace(/\s+/g, " ");
}

function stripNoisePhrases(text: string): string {
  return text
    .replace(/\b(?:can\s+you\s+(?:find|check|get|book|look)|i\s+(?:need|want)\s+(?:to|a)|looking\s+for|what\s+are\s+my\s+options|get\s+me)\b/gi, " ")
    .replace(/\b(?:nonstop|non[- ]?stop|direct|one[- ]?way|round[- ]?trip|cheap(?:est)?|options?)\b/gi, " ")
    .replace(/\b(?:just|really|please|preferably|prefer|preferred|I'd\s+love|at\s+least)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordToNumber(word: string): number {
  const map: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  return map[word.toLowerCase()] ?? 1;
}

// ────────────────────────────────────────────────────────────────────────────
// Date parsing
// ────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function parseDate(raw: string): string | null {
  const cleaned = raw
    .replace(/(st|nd|rd|th)/gi, "")
    .replace(/,/g, "")
    .trim();

  // ISO format: 2026-03-20
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD or MM/DD/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3]
      ? slashMatch[3].length === 2
        ? `20${slashMatch[3]}`
        : slashMatch[3]
      : guessYear(parseInt(month));
    return `${year}-${month}-${day}`;
  }

  // "March 20" or "March 20 2026"
  const textMatch = cleaned.match(/^(\w+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (textMatch) {
    const monthStr = textMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthStr];
    if (month) {
      const day = textMatch[2].padStart(2, "0");
      const year = textMatch[3] || guessYear(parseInt(month));
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function guessYear(month: number): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return month < currentMonth ? String(currentYear + 1) : String(currentYear);
}
