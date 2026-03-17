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

  // Phase 1: Find the primary route (origin → destination)
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
// Route extraction — validation-based scanning approach
// Scans for "to" / "from" separators, then validates both sides as airports.
// No text stripping needed — airport resolution acts as the filter.
// ────────────────────────────────────────────────────────────────────────────

function extractRoute(text: string): { origin: string; destination: string } | null {
  // Try patterns from most specific to least specific
  const result =
    scanFromTo(text) ??
    scanTo(text) ??
    scanReversed(text) ??
    scanFlyingOutOf(text);
  return result;
}

/**
 * Scan for "from {CITY} to {CITY}" patterns.
 * e.g. "from New York to Tokyo", "from LAX to Miami", "from SFO to Paris"
 */
function scanFromTo(text: string): { origin: string; destination: string } | null {
  const re = /\bfrom\s+/gi;
  let fromMatch;
  while ((fromMatch = re.exec(text)) !== null) {
    const afterFrom = text.substring(fromMatch.index + fromMatch[0].length);
    const toMatch = afterFrom.match(/\s+to\s+/i);
    if (!toMatch || toMatch.index === undefined) continue;

    const originText = afterFrom.substring(0, toMatch.index);
    const destText = afterFrom.substring(toMatch.index + toMatch[0].length);

    const origin = extractCityFromText(originText, "start");
    const destination = extractCityFromText(destText, "start");

    if (origin && destination) return { origin, destination };
  }
  return null;
}

/**
 * Scan for "{CITY} to {CITY}" patterns (without "from").
 * e.g. "Chicago to London", "JFK to Rome", "Dallas to Amsterdam"
 */
function scanTo(text: string): { origin: string; destination: string } | null {
  const re = /\s+to\s+/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const before = text.substring(Math.max(0, match.index - 60), match.index);
    const after = text.substring(match.index + match[0].length);

    const origin = extractCityFromText(before, "end");
    const destination = extractCityFromText(after, "start");

    if (origin && destination) return { origin, destination };
  }
  return null;
}

/**
 * Scan for "to {DEST} from {ORIGIN}" reversed patterns.
 * e.g. "Get me to Singapore from Houston", "fly to Paris from SFO"
 */
function scanReversed(text: string): { origin: string; destination: string } | null {
  const re = /\s+from\s+/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const before = text.substring(Math.max(0, match.index - 60), match.index);
    const after = text.substring(match.index + match[0].length);

    const destination = extractCityFromText(before, "end");
    const origin = extractCityFromText(after, "start");

    if (origin && destination) return { origin, destination };
  }
  return null;
}

/**
 * Scan for "be in {DEST} ... flying out of {ORIGIN}" patterns.
 * e.g. "Need to be in Boston by 9am, flying out of DC"
 */
function scanFlyingOutOf(text: string): { origin: string; destination: string } | null {
  const outOfMatch = text.match(
    /(?:flying|depart(?:ing)?)\s+out\s+of\s+([\w\s]+?)(?:\s*[,;.]|\s+(?:on|to|at|by)\b|\s*$)/i
  );
  if (!outOfMatch) return null;
  const origin = extractCityFromText(outOfMatch[1], "start");
  if (!origin) return null;

  // Look for destination from "be in Y" / "get to Y" / "arrive in Y"
  const destMatch = text.match(
    /(?:be\s+in|get\s+to|arrive\s+(?:in|at))\s+([\w\s]+?)(?:\s+(?:by|on|at|before)\b|\s*[,;.])/i
  );
  if (destMatch) {
    const destination = extractCityFromText(destMatch[1], "start");
    if (destination) return { origin, destination };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// City extraction from text — sliding window with airport validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract a valid city/airport name from a text fragment.
 * Uses a sliding window of 1-3 words, validated against the airport database.
 *
 * @param direction "start" = search from beginning of text, "end" = search from end
 */
function extractCityFromText(text: string, direction: "start" | "end"): string | null {
  const cleaned = text.replace(/[,;—–.!?]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const words = cleaned.split(/\s+/);
  const maxOffset = 4; // How far from the edge to search

  if (direction === "start") {
    for (let start = 0; start < Math.min(maxOffset, words.length); start++) {
      // Try longer matches first (3, 2, 1 words)
      for (let len = Math.min(3, words.length - start); len >= 1; len--) {
        const candidate = words.slice(start, start + len).join(" ");
        if (resolveAirport(candidate)) return candidate;
      }
    }
  } else {
    for (let end = words.length; end > Math.max(0, words.length - maxOffset); end--) {
      for (let len = Math.min(3, end); len >= 1; len--) {
        const candidate = words.slice(end - len, end).join(" ");
        if (resolveAirport(candidate)) return candidate;
      }
    }
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
  // Check for compact same-month range: "March 20-30" or "March 20th-30th"
  const compactRange = text.match(
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i
  );
  if (compactRange) {
    const monthWord = compactRange[1].trim();
    const d1 = parseDate(`${monthWord} ${compactRange[2]}${compactRange[4] ? " " + compactRange[4] : ""}`);
    const d2 = parseDate(`${monthWord} ${compactRange[3]}${compactRange[4] ? " " + compactRange[4] : ""}`);
    if (d1 && d2) return { outbound: d1, return: d2 };
  }

  // Check for date range: "DATE to DATE" or "DATE - DATE" or "DATE through DATE"
  const dateRangePattern =
    /(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:to|through|thru|-|–|—)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;
  const rangeMatch = text.match(dateRangePattern);
  if (rangeMatch) {
    const d1 = parseDate(rangeMatch[1]);
    const d2 = parseDate(rangeMatch[2]);
    if (d1 && d2) return { outbound: d1, return: d2 };
  }

  // Check for explicit return date markers
  let returnDate: string | null = null;
  const returnDateMatch = text.match(
    /(?:return(?:ing)?|back|inbound|coming\s+(?:back|home))\s+(?:on\s+)?(?:the\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );
  if (returnDateMatch) returnDate = parseDate(returnDateMatch[1]);

  // Check for explicit outbound date markers
  let outbound: string | null = null;
  const outboundDateMatch = text.match(
    /(?:depart(?:ing)?|outbound|leaving|on)\s+(?:the\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );
  if (outboundDateMatch) outbound = parseDate(outboundDateMatch[1]);

  // Fallback: collect all date tokens in order of appearance
  const allDates = findAllDateTokens(text);

  if (!outbound && allDates.length > 0) {
    outbound = allDates[0];
  }

  if (!returnDate && allDates.length > 1) {
    const candidate = allDates[1];
    if (candidate !== outbound) returnDate = candidate;
  }

  return { outbound, return: returnDate };
}

function findAllDateTokens(text: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // Collect all date-like tokens in order of appearance using a unified pass
  const unified =
    /\b(\d{4}-\d{2}-\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi;

  let m;
  while ((m = unified.exec(text)) !== null) {
    const parsed = parseDate(m[1]);
    if (parsed && !seen.has(parsed)) {
      seen.add(parsed);
      results.push(parsed);
    }
  }

  return results;
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
  // Use negative lookahead to avoid matching "first thing (in the morning)"
  const cabinMatch = text.match(
    /\b(first\s*class|business\s*class|premium\s*economy|economy|business|first(?!\s+thing))\b/gi
  );
  if (!cabinMatch) return null;

  // Use the first non-directional mention as global default
  const lower = text.toLowerCase();
  for (const match of cabinMatch) {
    const idx = lower.indexOf(match.toLowerCase());
    const surrounding = lower.substring(Math.max(0, idx - 30), Math.min(lower.length, idx + match.length + 30));
    if (/\b(out|back|return|there|home|going|coming)\b/.test(surrounding)) continue;
    return parseCabinWord(match);
  }
  return parseCabinWord(cabinMatch[0]);
}

function extractPassengers(text: string): { adults: number; children: number; infants: number } {
  let adults = 1;
  let children = 0;
  let infants = 0;

  const adultMatch = text.match(/(\d+)\s*adults?/i);
  if (adultMatch) adults = parseInt(adultMatch[1]);

  const wordAdults = text.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+adults?\b/i);
  if (wordAdults) adults = wordToNumber(wordAdults[1]);

  if (!adultMatch && !wordAdults) {
    const forN = text.match(/\b(?:for|flights?\s+for)\s+(\d+|two|three|four|five)\b/i);
    if (forN) adults = /\D/.test(forN[1]) ? wordToNumber(forN[1]) : parseInt(forN[1]);
  }

  if (/\bflying\s+solo\b/i.test(text)) adults = 1;

  const childMatch = text.match(/(\d+)\s*(?:children|child|kids?)/i);
  if (childMatch) children = parseInt(childMatch[1]);

  const infantMatch = text.match(/(\d+)\s*infants?/i);
  if (infantMatch) infants = parseInt(infantMatch[1]);

  return { adults, children, infants };
}

function extractMaxStops(text: string): number | null {
  const lower = text.toLowerCase();

  // "prefer direct but will do one stop" → use the flexible constraint
  const preferBut = lower.match(
    /prefer\s+(?:direct|nonstop|non[- ]?stop).*?(?:will|would|can)\s+(?:do|accept|take)\s+(\d+|one|two|three)\s+stops?/i
  );
  if (preferBut) {
    const val = preferBut[1];
    return /\d/.test(val) ? parseInt(val) : wordToNumber(val);
  }

  // Hard "nonstop" / "non-stop"
  if (/\b(?:non[- ]?stop|nonstop)\b/i.test(lower)) return 0;

  // "direct" only when not preceded by "prefer" (soft preference)
  if (/\bdirect\b/.test(lower) && !/prefer\s+direct/.test(lower)) return 0;

  // "prefer direct" alone (no "but" clause) — treat as 0
  if (/prefer\s+direct\b/.test(lower)) return 0;

  // Explicit stop count: "one stop", "two stops", "1 stop"
  const stopsMatch = lower.match(/(?:up\s+to\s+)?(\d+|one|two|three)\s+stops?\b/i);
  if (stopsMatch) {
    const val = stopsMatch[1];
    return /\d/.test(val) ? parseInt(val) : wordToNumber(val);
  }

  return null;
}

function extractPriority(text: string): SearchPriority | null {
  const lower = text.toLowerCase();
  if (/\b(?:cheap(?:est)?|lowest\s*(?:price|fare|cost)|budget|want\s+the\s+cheapest)\b/.test(lower)) return "Price";
  if (/\b(?:quick(?:est)?|fast(?:est)?|shortest|least\s+time)\b/.test(lower)) return "Duration";
  if (/\b(?:comfort(?:able)?|flat\s*bed|lie[- ]?flat|luxury)\b/.test(lower)) return "Comfort";
  return null;
}

function extractNotes(text: string, notes: string[]): void {
  // Conditional upgrade preferences
  const upgradeMatch = text.match(
    /(?:i'?d\s+upgrade|would\s+upgrade|open\s+to\s+upgrading?|willing\s+to\s+upgrade)\s+(?:to\s+)?(.+?)(?:\s+if\b|$)/i
  );
  if (upgradeMatch) {
    notes.push(`Conditional upgrade interest: ${upgradeMatch[0].trim()}`);
  }

  // Arrival time constraint
  const arrivalMatch = text.match(
    /\b(?:(?:need\s+to\s+)?be\s+(?:there|in\s+\w+)\s+by|arrive\s+(?:by|before))\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (arrivalMatch) {
    notes.push(`Arrival constraint: by ${arrivalMatch[1]}`);
  }

  // Stop flexibility
  const flexMatch = text.match(/willing\s+to\s+do\s+(one|two|\d+)\s+stops?\s*(.*?)(?:\.|$)/i);
  if (flexMatch) {
    notes.push(`Stop flexibility: ${flexMatch[0].trim()}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Time extraction — first-mentioned preference wins
// ────────────────────────────────────────────────────────────────────────────

function extractClauseTime(clause: string): DepartureTimeWindow | undefined {
  const lower = clause.toLowerCase();

  // Find the earliest-occurring time reference in the text
  const timePatterns: [RegExp, DepartureTimeWindow][] = [
    [/\b(?:red[- ]?eye|overnight|late[- ]?night)\b/, "RedEye"],
    [/\bevening\b/, "Evening"],
    [/\bearly\s+afternoon\b/, "Afternoon"],
    [/\bmorning\b/, "Morning"],
    [/\bfirst\s+thing\b/, "Morning"],
    [/\bearliest(?:\s+possible)?\b/, "Morning"],
    [/\bafternoon\b/, "Afternoon"],
    [/\bearly\b/, "Morning"],
  ];

  let earliest: { index: number; window: DepartureTimeWindow } | null = null;
  for (const [pattern, window] of timePatterns) {
    const m = lower.match(pattern);
    if (m && m.index !== undefined) {
      if (!earliest || m.index < earliest.index) {
        earliest = { index: m.index, window };
      }
    }
  }

  return earliest?.window;
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
  if (/afternoon/.test(lower)) return "Afternoon";
  if (/morning|early|earliest|first\s+thing/.test(lower)) return "Morning";
  return "Any";
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
