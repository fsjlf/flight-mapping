import {
  EnrichedItinerary,
  EnrichedSegment,
  BrandInfo,
  SegmentInput,
  SearchResponse,
} from "./types";
import { groupItineraries, LinkedLegGroup } from "./itineraryGrouping";
import { buildFlightKey } from "./itineraryGrouping2";

// ── Strategy Model Types ──────────────────────────────────────────────────────

export interface FareTerms {
  changePolicy: "free" | "fee" | "none";   // Penalty-Free Changes / Changeable for Fee / Not Changeable
  changeSummary: string;                    // Human-readable: "Free Changes", "Changes for Fee", "No Changes"
  refundPolicy: "full" | "fee" | "none";   // Fully Refundable / Refundable with Penalty / Non-refundable
  refundSummary: string;                    // "Fully Refundable", "Refundable ($200 Penalty)", "Non-refundable"
  baggage: string;                          // "2x Checked Bag", "1x Checked Bag", "No Checked Bag", ""
  seatType: string;                         // "Full Flat Pod", "Recliner", "" (from brand features)
  seatsAvailable: number;                   // seats remaining (from first leg)
  highlights: string[];                     // top 3-4 notable features for display
}

export interface Variant {
  itinerary: EnrichedItinerary;
  label: string; // e.g. "ECONOMY FLEX" or "Business Y"
  perAdult: number;
  refundable: boolean;
  cabin: string;           // combined label e.g. "Business → Economy" for mixed-cabin
  cabins: string[];        // per-segment cabin classes e.g. ["Business", "Economy"]
  bookingClass: string;
  brandName?: string;
  validatingCarrier: string; // who tickets/sells this fare
  fareTerms: FareTerms;
}

export interface Option {
  id: string; // flightKey-based
  carrier: string; // validating carrier
  carrierName: string;
  flightKey: string;
  segments: EnrichedSegment[];
  totalDuration: string;
  totalDurationMinutes: number;
  stops: number;
  score: number;
  variants: Variant[];
}

export interface Slot {
  id: string;
  label: string; // "TICKET 1 OF 1", "TICKET 1", etc.
  coverage: string; // "JFK → CDG → BUD → JFK"
  note: string; // "All 3 legs · 1 PNR"
  coveredLegIndices: number[];
  options: Option[];
}

export interface Strategy {
  id: string;
  num: string; // "01", "02", etc.
  label: string;
  tagline: string;
  color: string;
  colorDim: string;
  colorBorder: string;
  pros: string[];
  cons: string[];
  slots: Slot[];
}

export interface StrategyModel {
  strategies: Strategy[];
  routeSummary: string; // "JFK · CDG · BUD · JFK"
  dateSummary: string; // "Apr 15–25, 2026"
  paxSummary: string; // "1 Adult"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARRIER_NAMES: Record<string, string> = {
  AF: "Air France", KL: "KLM", AY: "Finnair", DL: "Delta",
  AA: "American Airlines", UA: "United Airlines", LH: "Lufthansa",
  LO: "LOT Polish", JU: "Air Serbia", AC: "Air Canada",
  OS: "Austrian Airlines", SN: "Brussels Airlines", LX: "Swiss",
  B6: "JetBlue", IB: "Iberia", BA: "British Airways", EK: "Emirates",
  QR: "Qatar Airways", TK: "Turkish Airlines", SK: "SAS",
  AZ: "ITA Airways", TP: "TAP Portugal", EI: "Aer Lingus",
  EY: "Etihad", SQ: "Singapore Airlines", CX: "Cathay Pacific",
  NH: "ANA", JL: "JAL", QF: "Qantas", VS: "Virgin Atlantic",
  WN: "Southwest", AS: "Alaska Airlines", NK: "Spirit",
  F9: "Frontier", G4: "Allegiant", HA: "Hawaiian Airlines",
  WS: "WestJet", AM: "Aeroméxico", CM: "Copa Airlines",
  AV: "Avianca", LA: "LATAM", AR: "Aerolíneas Argentinas",
  FI: "Icelandair", DY: "Norwegian", W6: "Wizz Air",
  FR: "Ryanair", U2: "easyJet", VY: "Vueling",
};

function carrierName(code: string): string {
  return CARRIER_NAMES[code] || code;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function totalStops(segments: EnrichedSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.stops, 0);
}

// ── Fare Terms Extraction ────────────────────────────────────────────────────

function extractFareTerms(itin: EnrichedItinerary): FareTerms {
  // Collect all brand features across segments
  const allFeatures: BrandInfo["features"] = [];
  for (const seg of itin.segments) {
    if (seg.brand?.features) {
      allFeatures.push(...seg.brand.features);
    }
  }

  // Application codes: F/I = Free/Included, C = Chargeable, N = Not offered, D = Display
  const find = (keywords: string[], svcGroup?: string) =>
    allFeatures.find((f) => {
      const nameMatch = keywords.some((kw) => f.name?.toUpperCase().includes(kw));
      if (svcGroup) return nameMatch && f.serviceGroup === svcGroup;
      return nameMatch;
    });

  const findAll = (svcGroup: string) =>
    allFeatures.filter((f) => f.serviceGroup === svcGroup);

  // ── Change policy
  const changeFeat = find(["CHANGEABLE", "CHANGE"], "TS") || find(["CHANGEABLE", "CHANGE"]);
  let changePolicy: FareTerms["changePolicy"] = "none";
  let changeSummary = "No Changes";
  if (changeFeat) {
    const app = changeFeat.application?.toUpperCase();
    if (app === "F" || app === "I") {
      changePolicy = "free";
      changeSummary = "Free Changes";
    } else if (app === "C") {
      changePolicy = "fee";
      changeSummary = "Changes for Fee";
    }
  }
  // Fallback: if VITA flag is set, changes are allowed
  if (changePolicy === "none" && itin.farePolicy.vita) {
    changePolicy = "fee";
    changeSummary = "Changes for Fee";
  }

  // ── Refund policy
  const refundFeat = find(["REFUND"], "TS") || find(["REFUND"]);
  let refundPolicy: FareTerms["refundPolicy"] = "none";
  let refundSummary = "Non-refundable";
  if (!itin.farePolicy.nonRefundable) {
    if (refundFeat) {
      const app = refundFeat.application?.toUpperCase();
      if (app === "F" || app === "I") {
        refundPolicy = "full";
        refundSummary = "Fully Refundable";
      } else if (app === "C") {
        refundPolicy = "fee";
        refundSummary = "Refundable (Penalty)";
      }
    } else {
      refundPolicy = "fee";
      refundSummary = "Refundable";
    }
  }

  // ── Baggage
  const bagFeatures = findAll("BG")
    .filter((f) => f.application !== "N" && f.name?.toUpperCase().includes("CHECK"))
    .sort((a, b) => (a.serviceType || "").localeCompare(b.serviceType || ""));
  let baggage = "";
  if (bagFeatures.length > 0) {
    const freeBags = bagFeatures.filter((f) => f.application === "F" || f.application === "I");
    if (freeBags.length > 0) {
      baggage = `${freeBags.length}x Checked Bag`;
    } else {
      const chargeable = bagFeatures.filter((f) => f.application === "C");
      if (chargeable.length > 0) {
        baggage = "Checked Bag (Fee)";
      } else {
        baggage = "No Checked Bag";
      }
    }
  }
  // Fallback for premium cabins
  if (!baggage) {
    const cabin = itin.segments[0]?.cabin?.toLowerCase() || "";
    if (cabin.includes("business") || cabin.includes("first")) {
      baggage = "2x Checked Bag";
    }
  }

  // ── Seat type
  const seatFeatures = findAll("SA").concat(
    allFeatures.filter((f) =>
      f.name?.toUpperCase().match(/FLAT|POD|SUITE|RECLINER|LIE|CRADLE|THRONE/)
    )
  );
  let seatType = "";
  for (const f of seatFeatures) {
    const name = f.name?.toUpperCase() || "";
    if (name.includes("FLAT") || name.includes("POD") || name.includes("SUITE") || name.includes("LIE")) {
      seatType = f.name || "";
      break;
    }
  }

  // ── Seats available (from first leg of first segment)
  const seatsAvailable = itin.segments[0]?.legs?.[0]?.seatsAvailable || 0;

  // ── Build highlights (concise list of notable features)
  const highlights: string[] = [];
  if (changeSummary !== "No Changes") highlights.push(changeSummary);
  if (refundSummary !== "Non-refundable") highlights.push(refundSummary);
  if (baggage) highlights.push(baggage);
  if (seatType) highlights.push(seatType);
  // Add Wi-Fi/lounge if present
  const wifiFeat = find(["WIFI", "WI-FI"]);
  if (wifiFeat && (wifiFeat.application === "F" || wifiFeat.application === "I")) {
    highlights.push("Wi-Fi Included");
  }
  const loungeFeat = findAll("LG").find((f) => f.application === "F" || f.application === "I");
  if (loungeFeat) highlights.push("Lounge Access");

  return {
    changePolicy,
    changeSummary,
    refundPolicy,
    refundSummary,
    baggage,
    seatType,
    seatsAvailable,
    highlights,
  };
}

function buildVariantLabel(itin: EnrichedItinerary): string {
  // Collect per-segment brand names
  const brandNames = itin.segments.map((s) => s.brand?.name || "");
  const hasBrands = brandNames.some(Boolean);

  if (hasBrands) {
    const distinctBrands = [...new Set(brandNames.filter(Boolean))];
    if (distinctBrands.length === 1) {
      // Same brand on all segments
      return distinctBrands[0];
    }
    // Different brands per segment — show both: "Business Promo + Main Cabin"
    return brandNames.filter(Boolean).join(" + ");
  }

  // Non-branded: show cabin info (mixed or single)
  const perSegCabins = itin.segments.map((s) => s.cabin || "Economy");
  const distinct = [...new Set(perSegCabins)];
  const cabin = distinct.length > 1 ? perSegCabins.join(" → ") : (perSegCabins[0] || "Economy");
  const cls = itin.segments[0]?.bookingClass || "";
  return cls ? `${cabin} ${cls}` : cabin;
}

function buildCoverageLabel(
  coveredIndices: number[],
  searchSegments: SegmentInput[]
): string {
  return coveredIndices
    .map((i) => {
      const seg = searchSegments[i];
      return seg ? `${seg.origins[0]} → ${seg.destinations[0]}` : "";
    })
    .filter(Boolean)
    .join(" → ");
}

/** Group itineraries sharing the same physical flights into Options with Variants */
function groupIntoOptions(itineraries: EnrichedItinerary[]): Option[] {
  const flightMap = new Map<string, EnrichedItinerary[]>();
  const order: string[] = [];

  for (const itin of itineraries) {
    const key = buildFlightKey(itin);
    if (!flightMap.has(key)) {
      flightMap.set(key, []);
      order.push(key);
    }
    flightMap.get(key)!.push(itin);
  }

  return order.map((key) => {
    const group = flightMap.get(key)!;
    // Deduplicate by fare product + validating carrier, keep cheapest per combo
    const fareMap = new Map<string, EnrichedItinerary>();
    for (const itin of group) {
      const fareKey = `${itin.validatingCarrier}|` + itin.segments
        .map((s) => `${s.cabin}:${s.bookingClass}:${s.brand?.name || ""}`)
        .join("|");
      const existing = fareMap.get(fareKey);
      if (!existing || itin.pricing.pricePerAdult < existing.pricing.pricePerAdult) {
        fareMap.set(fareKey, itin);
      }
    }
    const deduplicated = Array.from(fareMap.values()).sort(
      (a, b) => a.pricing.pricePerAdult - b.pricing.pricePerAdult
    );

    const primary = deduplicated[0];
    const variants: Variant[] = deduplicated.map((itin) => {
      const perSegCabins = itin.segments.map((s) => s.cabin || "Economy");
      const distinctCabins = [...new Set(perSegCabins)];
      const cabinLabel = distinctCabins.length > 1
        ? perSegCabins.join(" → ")
        : (perSegCabins[0] || "Economy");
      return {
        itinerary: itin,
        label: buildVariantLabel(itin),
        perAdult: itin.pricing.pricePerAdult,
        refundable: !itin.farePolicy.nonRefundable,
        cabin: cabinLabel,
        cabins: perSegCabins,
        bookingClass: itin.segments[0]?.bookingClass || "",
        brandName: (() => {
          const brands = itin.segments.map((s) => s.brand?.name || "").filter(Boolean);
          const distinct = [...new Set(brands)];
          return distinct.length > 1 ? brands.join(" + ") : (distinct[0] || undefined);
        })(),
        validatingCarrier: itin.validatingCarrier,
        fareTerms: extractFareTerms(itin),
      };
    });

    return {
      id: `opt_${primary.id}`,
      carrier: primary.validatingCarrier,
      carrierName: carrierName(primary.validatingCarrier),
      flightKey: key,
      segments: primary.segments,
      totalDuration: primary.totalDurationFormatted,
      totalDurationMinutes: primary.totalDurationMinutes,
      stops: totalStops(primary.segments),
      score: primary.scores.overall,
      variants,
    };
  });
}

// ── Main Transform ────────────────────────────────────────────────────────────

export function transformToStrategyModel(
  response: SearchResponse,
  searchSegments: SegmentInput[],
  passengers: { adults: number; children: number }
): StrategyModel {
  const grouped = groupItineraries(response.itineraries, searchSegments);
  const strategies: Strategy[] = [];
  let stratNum = 1;

  const totalLegs = searchSegments.length;
  const routeParts = searchSegments.map((s) => s.origins[0] || "");
  // Add final destination
  if (searchSegments.length > 0) {
    routeParts.push(searchSegments[searchSegments.length - 1].destinations[0] || "");
  }
  const routeSummary = routeParts.join(" · ");

  // Date range
  const dates = searchSegments.map((s) => s.departureDate).filter(Boolean);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const fmtDate = (d: string) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };
  const dateSummary =
    firstDate === lastDate
      ? fmtDate(firstDate)
      : `${fmtDate(firstDate)} – ${fmtDate(lastDate)}`;

  const paxParts: string[] = [];
  if (passengers.adults > 0)
    paxParts.push(`${passengers.adults} Adult${passengers.adults > 1 ? "s" : ""}`);
  if (passengers.children > 0)
    paxParts.push(
      `${passengers.children} Child${passengers.children > 1 ? "ren" : ""}`
    );
  const paxSummary = paxParts.join(", ") || "1 Adult";

  // ── Strategy 1: Single Ticket (All-in-One) ──
  if (grouped.singleTickets.length > 0) {
    const options = groupIntoOptions(grouped.singleTickets);
    const fullCoverage = searchSegments
      .map((s) => s.origins[0] || "")
      .concat(searchSegments[searchSegments.length - 1]?.destinations[0] || "")
      .filter(Boolean)
      .join(" → ");

    strategies.push({
      id: "single",
      num: String(stratNum).padStart(2, "0"),
      label: totalLegs > 2 ? "All-in-One Circle" : "Round Trip",
      tagline:
        totalLegs > 2
          ? "One ticket. One carrier. Full disruption protection."
          : "One ticket covers both directions. Full protection.",
      color: "#a78bfa",
      colorDim: "rgba(167,139,250,0.1)",
      colorBorder: "rgba(167,139,250,0.25)",
      pros: [
        "Full airline rebooking if disrupted",
        "Single luggage check-in",
        "Miles on one program",
      ],
      cons: [
        "Highest price floor",
        "Less per-leg choice",
        "One disruption affects all legs",
      ],
      slots: [
        {
          id: "main",
          label: "TICKET 1 OF 1",
          coverage: fullCoverage,
          note: `All ${totalLegs} leg${totalLegs > 1 ? "s" : ""} · 1 PNR`,
          coveredLegIndices: searchSegments.map((_, i) => i),
          options,
        },
      ],
    });
    stratNum++;
  }

  // ── Strategy N: Hybrid / Linked-Leg Groups ──
  // Each distinct linked leg group pattern becomes a strategy
  if (grouped.linkedLegGroups.length > 0) {
    // Group linked groups by coverage pattern for strategy creation
    const patternMap = new Map<string, LinkedLegGroup[]>();
    for (const llg of grouped.linkedLegGroups) {
      const key = llg.coveredLegIndices.join(",");
      if (!patternMap.has(key)) patternMap.set(key, []);
      patternMap.get(key)!.push(llg);
    }

    for (const [, groups] of patternMap) {
      const coveredIndices = groups[0].coveredLegIndices;
      const uncoveredIndices = searchSegments
        .map((_, i) => i)
        .filter((i) => !coveredIndices.includes(i));

      // Merge all linked groups with same pattern
      const allLinkedItins = groups.flatMap((g) => g.itineraries);
      const linkedOptions = groupIntoOptions(allLinkedItins);

      const linkedCoverage = buildCoverageLabel(coveredIndices, searchSegments);
      const slots: Slot[] = [
        {
          id: "linked",
          label: "TICKET 1",
          coverage: linkedCoverage,
          note: `Legs ${coveredIndices.map((i) => i + 1).join(" & ")} · 1 PNR`,
          coveredLegIndices: coveredIndices,
          options: linkedOptions,
        },
      ];

      // Add OW slots for uncovered legs
      uncoveredIndices.forEach((legIdx, i) => {
        const legItins = grouped.separateByLeg[legIdx] || [];
        const owOptions = groupIntoOptions(legItins);
        const seg = searchSegments[legIdx];
        slots.push({
          id: `ow_${legIdx}`,
          label: `TICKET ${i + 2}`,
          coverage: seg ? `${seg.origins[0]} → ${seg.destinations[0]}` : `Leg ${legIdx + 1}`,
          note: `One-way · ${seg?.departureDate || ""}`,
          coveredLegIndices: [legIdx],
          options: owOptions,
        });
      });

      const hybridLabel =
        coveredIndices.length === 2
          ? "Transat RT + Internal OW"
          : `Linked ${coveredIndices.length}-Leg + OW`;

      strategies.push({
        id: `hybrid_${coveredIndices.join("_")}`,
        num: String(stratNum).padStart(2, "0"),
        label: hybridLabel,
        tagline: "Clever split — save on long-haul, buy the hop separately.",
        color: "#38bdf8",
        colorDim: "rgba(56,189,248,0.08)",
        colorBorder: "rgba(56,189,248,0.25)",
        pros: [
          "Often cheapest overall",
          "Flexibility on internal legs",
          "Can mix alliances",
        ],
        cons: [
          `${slots.length} PNRs to manage`,
          "No cross-ticket disruption protection",
          "Possible bag recheck",
        ],
        slots,
      });
      stratNum++;
    }
  }

  // ── Strategy N: All One-Ways ──
  const anyOwLegs = grouped.separateByLeg.some((leg) => leg.length > 0);
  if (anyOwLegs && totalLegs > 1) {
    const slots: Slot[] = searchSegments.map((seg, i) => {
      const legItins = grouped.separateByLeg[i] || [];
      const options = groupIntoOptions(legItins);
      return {
        id: `leg_${i}`,
        label: `TICKET ${i + 1}`,
        coverage: `${seg.origins[0]} → ${seg.destinations[0]}`,
        note: `One-way · ${seg.departureDate}`,
        coveredLegIndices: [i],
        options,
      };
    });

    strategies.push({
      id: "oneways",
      num: String(stratNum).padStart(2, "0"),
      label: "All One-Ways",
      tagline: "Maximum flexibility. Every leg on its own terms.",
      color: "#34d399",
      colorDim: "rgba(52,211,153,0.08)",
      colorBorder: "rgba(52,211,153,0.22)",
      pros: [
        "Lowest floor per leg",
        "Mix any carrier freely",
        "Cancel or upgrade each leg independently",
      ],
      cons: [
        `${totalLegs} separate bookings`,
        "Zero cross-ticket protection",
        "Bag recheck at each hub",
      ],
      slots,
    });
  }

  return { strategies, routeSummary, dateSummary, paxSummary };
}

// ── Build system prompt from strategy model ──────────────────────────────────

export function buildSystemPrompt(model: StrategyModel): string {
  const stratSummaries = model.strategies
    .map((s) => {
      const slotSummaries = s.slots
        .map((sl) => {
          const topOptions = sl.options
            .slice(0, 5)
            .map((opt) => {
              const cheapest = opt.variants[0];
              return `${carrierName(opt.carrier)} $${cheapest?.perAdult?.toFixed(2) || "?"}`;
            })
            .join(", ");
          return `  ${sl.label} (${sl.coverage}): ${topOptions}`;
        })
        .join("\n");
      return `S${s.num} ${s.label}:\n${slotSummaries}`;
    })
    .join("\n\n");

  return `You are a senior luxury travel consultant and fare construction expert. Helping build a flight comparison: ${model.routeSummary} · ${model.dateSummary} · ${model.paxSummary}.

${stratSummaries}

Equipment codes: 77W=777-300ER, 333=A330, 788=787-8, 789=787-9, 223=A220-300, 320=A320, 321=A321, 32N=A321neo, 738=737-800, 7M8=737 MAX 8.
FLEX/refundable vs BASIC/LIGHT/non-refundable fare distinctions.

RESPOND IN ONE OF TWO WAYS ONLY:

A) Normal chat — plain text answer. Be expert, concise.

B) Suggest new options — return ONLY this JSON, no other text:
{"type":"suggestions","message":"string","slots":[{"strategyId":"string","slotId":"string","options":[{"id":"ai_UNIQUE","carrier":"XX","carrierName":"Full Name","totalDuration":"Xh Xm","score":75,"segments":[{"origin":"XXX","destination":"XXX","departureTime":"ISO","arrivalTime":"ISO","durationFormatted":"Xh Xm","stops":0,"marketingCarrier":"XX","flightNumber":"XX000","equipment":"XXX"}],"variants":[{"label":"FARE NAME","perAdult":0,"refundable":false,"cabin":"Economy","bookingClass":"Y"}]}]}]}

C) Write proposal copy — when asked with scenarios, return ONLY:
{"type":"proposal_copy","introduction":"string","scenarios":[{"id":"string","rationale":"string"}],"recommendation":"string","advisorNotes":"string","watchOuts":["string"]}

Never wrap JSON in markdown. Use strategy IDs: ${model.strategies.map((s) => s.id).join(", ")}. Slot IDs per strategy: ${model.strategies.map((s) => `${s.id}: [${s.slots.map((sl) => sl.id).join(", ")}]`).join("; ")}.`;
}
