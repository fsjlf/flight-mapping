"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  SearchResponse,
  SegmentInput,
  PassengerConfig,
  EnrichedItinerary,
  EnrichedSegment,
} from "@/lib/types";
import {
  transformToStrategyModel,
  buildSystemPrompt,
  Strategy,
  Slot,
  Option,
  Variant,
  FareTerms,
  StrategyModel,
} from "@/lib/strategyTransform";

// ── Constants ─────────────────────────────────────────────────────────────────

const CARRIER_COLORS: Record<string, string> = {
  AF: "#002157", KL: "#00A1DE", AY: "#1B4799", DL: "#C41230",
  AA: "#0078D2", UA: "#005DAA", LH: "#05164D", LO: "#00539F",
  JU: "#5B21B6", AC: "#C8102E", OS: "#9B0000", SN: "#003580",
  LX: "#C8102E", B6: "#002244", IB: "#CC0000", BA: "#2B5BAB",
  EK: "#D71921", QR: "#5C0D34", TK: "#C8102E", SK: "#000066",
};

const pfmt = (n: number | null | undefined) =>
  n != null
    ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const tfmt = (s: string) => {
  try {
    return new Date(s).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return s?.slice(11, 16) || "";
  }
};

const dfmt = (s: string) => {
  try {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

// ── Types ─────────────────────────────────────────────────────────────────────

// Selection state: sels[strategyId][slotId] = Set of "optionId:variantIndex"
type SelectionState = Record<string, Record<string, Set<string>>>;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: AISuggestionSlot[];
}

interface AISuggestionSlot {
  strategyId: string;
  slotId: string;
  options: AIOption[];
}

interface AIOption {
  id: string;
  carrier: string;
  carrierName?: string;
  totalDuration?: string;
  score?: number;
  segments: {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    durationFormatted: string;
    stops: number;
    marketingCarrier: string;
    flightNumber: string;
    equipment?: string;
  }[];
  variants: {
    label: string;
    perAdult: number;
    refundable: boolean;
    cabin?: string;
    bookingClass?: string;
  }[];
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function CarrierChip({ code, size = 18 }: { code: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded shrink-0"
      style={{
        width: size,
        height: size,
        background: CARRIER_COLORS[code] || "#334155",
        fontSize: size < 16 ? 7 : 8,
        fontWeight: 900,
        color: "#fff",
        letterSpacing: 0.3,
      }}
    >
      {code}
    </span>
  );
}

// ── Fare Row ──────────────────────────────────────────────────────────────────

function FareRow({
  label,
  perAdult,
  refundable,
  fareTerms,
  checked,
  onToggle,
  color,
  segmentBrands,
}: {
  label: string;
  perAdult: number;
  refundable: boolean;
  fareTerms?: FareTerms;
  checked: boolean;
  onToggle: () => void;
  color: string;
  segmentBrands?: { origin: string; destination: string; brand: string; cabin: string }[];
}) {
  // Determine if we have mixed brands across segments
  const isMixedBrand = segmentBrands && segmentBrands.length > 1
    && new Set(segmentBrands.map((b) => b.brand)).size > 1;

  const CABIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Business: { bg: "rgba(139,115,85,0.15)", text: "#d4a96a", border: "rgba(139,115,85,0.3)" },
    First: { bg: "rgba(168,130,72,0.15)", text: "#d4a96a", border: "rgba(168,130,72,0.3)" },
    PremiumEconomy: { bg: "rgba(99,140,180,0.12)", text: "#7cb3d4", border: "rgba(99,140,180,0.25)" },
    Economy: { bg: "rgba(100,116,139,0.1)", text: "#94a3b8", border: "rgba(100,116,139,0.2)" },
  };

  return (
    <div
      onClick={onToggle}
      className="flex flex-col cursor-pointer rounded-[5px] my-[2px] transition-all duration-100"
      style={{
        padding: "5px 10px 5px 8px",
        background: checked ? `${color}18` : "transparent",
        border: `1px solid ${checked ? `${color}45` : "transparent"}`,
      }}
    >
      {/* Main row: checkbox + label + flex badge + price */}
      <div className="flex items-center gap-2">
        <div
          className="shrink-0 flex items-center justify-center transition-all duration-100"
          style={{
            width: 13,
            height: 13,
            borderRadius: 3,
            border: `1.5px solid ${checked ? color : "rgba(255,255,255,0.18)"}`,
            background: checked ? color : "transparent",
          }}
        >
          {checked && (
            <span style={{ color: "#080b14", fontSize: 8, fontWeight: 900, lineHeight: 1 }}>
              ✓
            </span>
          )}
        </div>
        {!isMixedBrand ? (
          <span
            className="text-[10px] flex-1"
            style={{ fontWeight: checked ? 700 : 400, color: checked ? "#f1f5f9" : "#6b7280" }}
          >
            {label}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {refundable && (
          <span className="text-[7px] font-bold tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-[5px] py-[1px] rounded-[3px]">
            FLEX
          </span>
        )}
        <span
          className="text-xs min-w-[56px] text-right"
          style={{
            fontWeight: 800,
            letterSpacing: -0.3,
            color: checked ? color : "#94a3b8",
          }}
        >
          {pfmt(perAdult)}
        </span>
      </div>

      {/* Per-segment brand badges for mixed-brand fares */}
      {isMixedBrand && segmentBrands && (
        <div className="flex items-center gap-[4px] pl-[21px] mt-[3px] mb-[1px] flex-wrap">
          {segmentBrands.map((sb, i) => {
            const colors = CABIN_COLORS[sb.cabin] || CABIN_COLORS.Economy;
            return (
              <span key={i} className="inline-flex items-center gap-[3px]">
                <span
                  className="text-[7px] font-bold tracking-wide rounded-[3px] px-[5px] py-[2px]"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {sb.origin}→{sb.destination}
                </span>
                <span
                  className="text-[8px] font-semibold"
                  style={{ color: checked ? "#e2e8f0" : "#9ca3af" }}
                >
                  {sb.brand}
                </span>
                {i < segmentBrands.length - 1 && (
                  <span className="text-[8px] text-slate-700 mx-[1px]">+</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {fareTerms && (fareTerms.changeSummary !== "No Changes" || fareTerms.baggage || fareTerms.seatsAvailable > 0) && (
        <div className="flex items-center gap-[6px] pl-[21px] mt-[2px] flex-wrap">
          {fareTerms.refundPolicy !== "none" && fareTerms.refundPolicy !== "full" && (
            <span className="text-[7px] text-amber-400/80">{fareTerms.refundSummary}</span>
          )}
          {fareTerms.changePolicy === "free" && (
            <span className="text-[7px] text-sky-400/70">Free Changes</span>
          )}
          {fareTerms.changePolicy === "fee" && (
            <span className="text-[7px] text-slate-500">Changes for Fee</span>
          )}
          {fareTerms.baggage && (
            <span className="text-[7px] text-slate-500">{fareTerms.baggage}</span>
          )}
          {fareTerms.seatType && (
            <span className="text-[7px] text-purple-400/70">{fareTerms.seatType}</span>
          )}
          {fareTerms.seatsAvailable > 0 && fareTerms.seatsAvailable <= 4 && (
            <span className="text-[7px] text-red-400/70">{fareTerms.seatsAvailable} left</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Carrier Fare Tabs ─────────────────────────────────────────────────────────

function CarrierFareTabs({
  option,
  selectedVariantIndices,
  onVariantToggle,
  color,
}: {
  option: Option;
  selectedVariantIndices: Set<number>;
  onVariantToggle: (optionId: string, variantIdx: number) => void;
  color: string;
}) {
  // Group variants by validating carrier, preserving original indices
  const carrierGroups = useMemo(() => {
    const groups = new Map<string, { variant: Variant; originalIndex: number }[]>();
    const order: string[] = [];
    for (let i = 0; i < option.variants.length; i++) {
      const v = option.variants[i];
      const vc = v.validatingCarrier || option.carrier;
      if (!groups.has(vc)) {
        groups.set(vc, []);
        order.push(vc);
      }
      groups.get(vc)!.push({ variant: v, originalIndex: i });
    }
    return { groups, order };
  }, [option.variants, option.carrier]);

  // Default to the operating carrier (first segment's marketing carrier)
  const operatingCarrier = option.segments[0]?.marketingCarrier || option.carrier;
  const defaultTab = carrierGroups.order.includes(operatingCarrier)
    ? operatingCarrier
    : carrierGroups.order[0] || option.carrier;
  const [activeCarrier, setActiveCarrier] = useState(defaultTab);

  const showTabs = carrierGroups.order.length > 1;
  const activeItems = carrierGroups.groups.get(activeCarrier) || [];

  return (
    <div className="px-2 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      {showTabs ? (
        <div className="flex items-center gap-[3px] px-[6px] pt-[5px] pb-[4px] flex-wrap">
          <span className="text-[7px] text-slate-600 tracking-[1.5px] uppercase font-semibold mr-1">
            Fares via
          </span>
          {carrierGroups.order.map((vc) => {
            const isActive = vc === activeCarrier;
            const count = carrierGroups.groups.get(vc)!.length;
            const hasSelected = carrierGroups.groups.get(vc)!.some((g) =>
              selectedVariantIndices.has(g.originalIndex)
            );
            return (
              <button
                key={vc}
                onClick={() => setActiveCarrier(vc)}
                className="flex items-center gap-[3px] rounded-[4px] transition-all duration-100"
                style={{
                  padding: "2px 6px",
                  fontSize: 9,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#f1f5f9" : "#6b7280",
                  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  border: `1px solid ${hasSelected ? `${color}40` : isActive ? "rgba(255,255,255,0.1)" : "transparent"}`,
                }}
              >
                <CarrierChip code={vc} size={12} />
                <span>{vc}</span>
                <span style={{ color: "#4b5563", fontSize: 8 }}>({count})</span>
                {hasSelected && (
                  <span style={{ color, fontSize: 7, fontWeight: 800 }}>●</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-[7px] text-slate-600 tracking-[1.5px] uppercase px-[10px] pt-[5px] pb-[3px] font-semibold">
          Fare class{option.variants.length > 1 ? "es" : ""}
        </div>
      )}
      {activeItems.map(({ variant: v, originalIndex: vi }) => {
        // Build per-segment brand info for mixed-brand badge display
        const segs = v.itinerary?.segments;
        const segBrands = segs && segs.length > 1
          ? segs.map((s) => ({
              origin: s.origin,
              destination: s.destination,
              brand: s.brand?.name || (s.cabin || "Economy"),
              cabin: s.cabin || "Economy",
            }))
          : undefined;
        return (
          <FareRow
            key={vi}
            label={v.label}
            perAdult={v.perAdult}
            refundable={v.refundable}
            fareTerms={v.fareTerms}
            checked={selectedVariantIndices.has(vi)}
            onToggle={() => onVariantToggle(option.id, vi)}
            color={color}
            segmentBrands={segBrands}
          />
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute +N day offset between departure and arrival ISO strings */
function dayOffset(dep: string, arr: string): number {
  try {
    const d = new Date(dep);
    const a = new Date(arr);
    const dDay = Math.floor(d.getTime() / 86400000);
    const aDay = Math.floor(a.getTime() / 86400000);
    return aDay - dDay;
  } catch {
    return 0;
  }
}

/** Build layover summary from segment legs: "1 stop · 2h 15m via DOH" */
function layoverSummary(seg: EnrichedSegment): string | null {
  if (seg.stops === 0 || !seg.legs || seg.legs.length <= 1) return null;
  const vias: string[] = [];
  const durations: number[] = [];
  for (let i = 0; i < seg.legs.length - 1; i++) {
    const arrTime = new Date(seg.legs[i].arrivalTime).getTime();
    const depTime = new Date(seg.legs[i + 1].departureTime).getTime();
    const mins = Math.round((depTime - arrTime) / 60000);
    durations.push(mins);
    vias.push(seg.legs[i].destination);
  }
  const totalLayover = durations.reduce((a, b) => a + b, 0);
  const h = Math.floor(totalLayover / 60);
  const m = totalLayover % 60;
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${seg.stops} stop${seg.stops > 1 ? "s" : ""} · ${timeStr} via ${vias.join(", ")}`;
}

// ── Option Card ───────────────────────────────────────────────────────────────

function OptionCard({
  option,
  color,
  selectedVariantIndices,
  onVariantToggle,
  onSelectAll,
  isAISuggested,
  isCheapest,
  priceVsCheapest,
}: {
  option: Option;
  color: string;
  selectedVariantIndices: Set<number>;
  onVariantToggle: (optionId: string, variantIdx: number) => void;
  onSelectAll: (option: Option, select: boolean) => void;
  isAISuggested?: boolean;
  isCheapest?: boolean;
  priceVsCheapest?: number;
}) {
  const [faresOpen, setFaresOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const anyChecked = selectedVariantIndices.size > 0;
  const allChecked = selectedVariantIndices.size === option.variants.length;

  // Auto-expand fares when any are checked
  const showFares = faresOpen || anyChecked;

  // Price range for card header
  const minPrice = Math.min(...option.variants.map((v) => v.perAdult));

  // Overall first departure and last arrival for summary line
  const firstSeg = option.segments[0];
  const lastSeg = option.segments[option.segments.length - 1];
  const overallDep = firstSeg?.departureTime || "";
  const overallArr = lastSeg?.arrivalTime || "";
  const plusDays = dayOffset(overallDep, overallArr);

  // Overall stops count across all segments
  const totalStops = option.segments.reduce((sum, s) => sum + s.stops, 0);

  // Build connection summary for single-segment options
  const singleSegLayover = option.segments.length === 1 ? layoverSummary(option.segments[0]) : null;

  return (
    <div
      className="rounded-lg mb-[6px] overflow-hidden transition-all duration-150"
      style={{
        border: `1px solid ${anyChecked ? `${color}55` : "rgba(255,255,255,0.06)"}`,
        background: anyChecked ? `${color}08` : "rgba(255,255,255,0.015)",
      }}
    >
      {/* ── Summary Row (always visible, scannable) ── */}
      <div
        className="flex items-center gap-[8px] p-[9px_12px] cursor-pointer"
        onClick={() => setFaresOpen(!faresOpen)}
      >
        {/* Select-all toggle */}
        <div
          onClick={(e) => { e.stopPropagation(); onSelectAll(option, !allChecked); }}
          className="shrink-0 cursor-pointer flex items-center justify-center transition-all duration-150"
          style={{
            width: 15,
            height: 15,
            borderRadius: 4,
            border: `1.5px solid ${anyChecked ? color : "rgba(255,255,255,0.15)"}`,
            background: allChecked ? color : "transparent",
          }}
        >
          {allChecked && (
            <span style={{ color: "#080b14", fontSize: 8, fontWeight: 900 }}>✓</span>
          )}
          {anyChecked && !allChecked && (
            <div style={{ width: 6, height: 1.5, background: color, borderRadius: 1 }} />
          )}
        </div>

        {/* Carrier chip */}
        <CarrierChip code={option.carrier} size={20} />

        {/* Schedule: dep → arr (PRIMARY) */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-[5px]">
            <span className="text-[13px] font-extrabold text-slate-100 tracking-tight leading-none">
              {tfmt(overallDep)}
            </span>
            <span className="text-[10px] text-slate-600">–</span>
            <span className="text-[13px] font-extrabold text-slate-100 tracking-tight leading-none">
              {tfmt(overallArr)}
            </span>
            {plusDays > 0 && (
              <sup className="text-[8px] font-bold text-orange-400 leading-none" style={{ position: "relative", top: -4 }}>
                +{plusDays}
              </sup>
            )}
          </div>
          <div className="flex items-center gap-[5px] mt-[2px]">
            <span className="text-[9px] text-slate-500 font-medium">
              {option.carrierName}
            </span>
            {option.segments.map((seg, i) => (
              <span key={i} className="text-[8px] font-mono text-slate-600">{seg.flightNumber}</span>
            ))}
            {isAISuggested && (
              <span className="text-[7px] font-bold tracking-wider text-indigo-400 bg-indigo-400/10 border border-indigo-400/25 px-[4px] py-[0.5px] rounded-[3px]">
                ✦ AI
              </span>
            )}
          </div>
        </div>

        {/* Duration column */}
        <div className="flex flex-col items-center ml-auto shrink-0" style={{ minWidth: 52 }}>
          <span className="text-[10px] font-semibold text-slate-400">{option.totalDuration}</span>
          {totalStops === 0 ? (
            <span className="text-[8px] text-emerald-500 font-semibold">Nonstop</span>
          ) : singleSegLayover ? (
            <span className="text-[8px] text-orange-400/80">{singleSegLayover}</span>
          ) : (
            <span className="text-[8px] text-orange-400/80">
              {totalStops} stop{totalStops > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Price column (right-anchored) */}
        <div className="flex flex-col items-end shrink-0" style={{ minWidth: 70 }}>
          <span className="text-[12px] font-extrabold text-slate-200 tracking-tight">
            {pfmt(minPrice)}
          </span>
          <div className="flex items-center gap-[3px]">
            {isCheapest && (
              <span className="text-[7px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-[4px] py-[0.5px] rounded-[3px]">
                CHEAPEST
              </span>
            )}
            {!isCheapest && priceVsCheapest != null && priceVsCheapest > 0 && (
              <span className="text-[8px] text-slate-600">+{pfmt(priceVsCheapest)}</span>
            )}
            {anyChecked && (
              <span
                className="text-[7px] font-bold rounded-[8px] px-[5px] py-[1px]"
                style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
              >
                {selectedVariantIndices.size}✓
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <span className="text-[10px] text-slate-700 ml-[2px]">
          {showFares ? "▲" : "▼"}
        </span>
      </div>

      {/* ── Multi-segment details (only when >1 segment, always visible) ── */}
      {option.segments.length > 1 && (
        <div
          className="flex flex-col gap-[2px] px-3 pb-[6px]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
        >
          {option.segments.map((seg, i) => {
            const segPlusDays = dayOffset(seg.departureTime, seg.arrivalTime);
            const segLayover = layoverSummary(seg);
            return (
              <div key={i} className="flex items-center gap-[6px] pl-[23px]">
                <CarrierChip code={seg.marketingCarrier} size={12} />
                <span className="font-mono text-[8px] font-bold text-slate-600 w-[38px] shrink-0">
                  {seg.flightNumber}
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  {tfmt(seg.departureTime)}
                </span>
                <span className="text-[8px] text-slate-700">–</span>
                <span className="text-[10px] font-bold text-slate-300">
                  {tfmt(seg.arrivalTime)}
                </span>
                {segPlusDays > 0 && (
                  <sup className="text-[7px] font-bold text-orange-400" style={{ position: "relative", top: -3 }}>+{segPlusDays}</sup>
                )}
                <span className="text-[8px] text-slate-600">
                  {seg.origin}–{seg.destination}
                </span>
                {seg.cabin && seg.cabin !== "Economy" && (
                  <span className="text-[7px] font-bold tracking-wider px-[4px] py-[0.5px] rounded-[3px] bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    {seg.cabin === "PremiumEconomy" ? "PREM" : seg.cabin === "Business" ? "BIZ" : seg.cabin === "First" ? "FIRST" : String(seg.cabin).toUpperCase()}
                  </span>
                )}
                <span className="text-[8px] text-slate-700 ml-auto">{seg.durationFormatted}</span>
                {seg.stops === 0 ? (
                  <span className="text-[7px] text-emerald-600">Non</span>
                ) : segLayover ? (
                  <span className="text-[7px] text-orange-500/80">{segLayover}</span>
                ) : (
                  <span className="text-[7px] text-orange-500">{seg.stops}✗</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fare rows (expanded on click or when any checked) ── */}
      {showFares && (
        <CarrierFareTabs
          option={option}
          selectedVariantIndices={selectedVariantIndices}
          onVariantToggle={onVariantToggle}
          color={color}
        />
      )}

      {/* ── Flight details toggle ── */}
      {showFares && (
        <div
          className="px-3 py-[4px] flex items-center justify-between cursor-pointer"
          style={{ borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(0,0,0,0.15)" }}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <span className="text-[8px] text-slate-600">{detailsOpen ? "Hide details" : "Flight details"}</span>
          <span className="text-[8px] text-slate-700">{detailsOpen ? "▲" : "▼"}</span>
        </div>
      )}
      {detailsOpen && showFares && (
        <div
          className="py-[8px] px-[14px]"
          style={{ background: "rgba(0,0,0,0.22)" }}
        >
          {option.segments.map((seg, si) => (
            <div key={si} className={si > 0 ? "mt-[8px]" : ""}>
              {/* Segment header for multi-segment options */}
              {option.segments.length > 1 && (
                <div className="text-[8px] text-slate-500 tracking-[1px] uppercase font-semibold mb-[6px]">
                  Segment {si + 1} — {seg.origin} → {seg.destination}
                </div>
              )}

              {/* Leg-by-leg timeline */}
              {seg.legs && seg.legs.length > 0 ? (
                <div className="flex flex-col">
                  {seg.legs.map((leg, li) => {
                    const legPlusDays = dayOffset(leg.departureTime, leg.arrivalTime);
                    const layoverToNext = leg.connectionTimeToNextMinutes;
                    const nextLeg = seg.legs[li + 1];
                    const acName = leg.equipment ? aircraftName(leg.equipment) : "";
                    const isCodeshare = leg.operatingCarrier !== leg.marketingCarrier;
                    const opName = isCodeshare ? (CARRIER_FULL_NAMES[leg.operatingCarrier] || leg.operatingCarrier) : "";

                    return (
                      <div key={li}>
                        {/* Departure */}
                        <div className="flex items-start gap-[10px]">
                          <div className="flex flex-col items-center" style={{ width: 12 }}>
                            <div className="w-[7px] h-[7px] rounded-full border-2 mt-[2px]" style={{ borderColor: "rgba(148,163,184,0.5)" }} />
                            <div className="w-[1.5px] flex-1 min-h-[20px]" style={{ background: "rgba(148,163,184,0.2)" }} />
                          </div>
                          <div className="flex-1 pb-[4px]">
                            <div className="flex items-baseline gap-[6px]">
                              <span className="text-[11px] font-bold text-slate-200">{tfmt(leg.departureTime)}</span>
                              <span className="text-[9px] text-slate-500">{dfmt(leg.departureTime)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {leg.originCity ? `${leg.originCity} (${leg.origin})` : leg.origin}
                            </div>
                            <div className="text-[8px] text-slate-600 mt-[3px]">
                              Travel time: {Math.floor(leg.durationMinutes / 60)}h {leg.durationMinutes % 60}m
                            </div>
                          </div>
                        </div>

                        {/* Arrival */}
                        <div className="flex items-start gap-[10px]">
                          <div className="flex flex-col items-center" style={{ width: 12 }}>
                            <div className="w-[7px] h-[7px] rounded-full border-2 mt-[2px]" style={{ borderColor: "rgba(148,163,184,0.5)" }} />
                            {(layoverToNext != null && layoverToNext > 0) && (
                              <div className="w-[1.5px] flex-1 min-h-[12px]" style={{ background: "rgba(148,163,184,0.1)" }} />
                            )}
                          </div>
                          <div className="flex-1 pb-[2px]">
                            <div className="flex items-baseline gap-[6px]">
                              <span className="text-[11px] font-bold text-slate-200">
                                {tfmt(leg.arrivalTime)}
                              </span>
                              {legPlusDays > 0 && (
                                <sup className="text-[8px] font-bold text-orange-400">+{legPlusDays}</sup>
                              )}
                              <span className="text-[9px] text-slate-500">{dfmt(leg.arrivalTime)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {leg.destinationCity ? `${leg.destinationCity} (${leg.destination})` : leg.destination}
                            </div>
                            {/* Carrier + aircraft info */}
                            <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                              <CarrierChip code={leg.marketingCarrier} size={14} />
                              <span className="text-[8px] text-slate-500">
                                {CARRIER_FULL_NAMES[leg.marketingCarrier] || leg.marketingCarrier}
                                {" · "}
                                {seg.cabin}
                                {" · "}
                                {leg.flightNumber}
                              </span>
                              {acName && (
                                <span className="text-[8px] text-slate-600">· {acName}</span>
                              )}
                            </div>
                            {isCodeshare && (
                              <div className="text-[8px] text-amber-500/70 mt-[1px]">
                                Operated by {opName} {leg.operatingCarrier !== leg.marketingCarrier ? leg.operatingCarrier + leg.operatingFlightNumber : ""}
                              </div>
                            )}
                            {leg.mealCode && leg.mealCode !== "N" && (
                              <span className="text-[8px] text-slate-600 mt-[1px]">Meal service included</span>
                            )}
                          </div>
                        </div>

                        {/* Layover between legs */}
                        {layoverToNext != null && layoverToNext > 0 && nextLeg && (
                          <div
                            className="flex items-center gap-[10px] my-[4px] ml-[2px]"
                          >
                            <div style={{ width: 12 }} />
                            <div
                              className="flex-1 rounded-[5px] px-[10px] py-[5px]"
                              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.12)" }}
                            >
                              <span className="text-[9px] text-amber-400/80 font-medium">
                                {Math.floor(layoverToNext / 60)}h {layoverToNext % 60}m layover
                                {" · "}
                                {leg.destinationCity ? `${leg.destinationCity} (${leg.destination})` : leg.destination}
                              </span>
                              {layoverToNext < 90 && (
                                <span className="text-[8px] text-red-400/70 ml-[6px]">Tight connection</span>
                              )}
                              {layoverToNext > 360 && (
                                <span className="text-[8px] text-amber-500/50 ml-[6px]">Long layover</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback when no legs data — show basic segment info */
                <div className="text-[9px] text-slate-600 flex gap-2 items-center py-[2px]">
                  <CarrierChip code={seg.marketingCarrier} size={14} />
                  <span className="font-semibold text-slate-500">{seg.flightNumber}</span>
                  {seg.equipment && <span>· {aircraftName(seg.equipment)}</span>}
                  {seg.operatingCarrier !== seg.marketingCarrier && (
                    <span>· Operated by {CARRIER_FULL_NAMES[seg.operatingCarrier] || seg.operatingCarrier}</span>
                  )}
                  <span>· {seg.cabin} {seg.bookingClass}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Option Card (for chat suggestions) ─────────────────────────────────────

function AIOptionCard({
  opt,
  strategyId,
  slotId,
  color,
  sels,
  onToggleFare,
}: {
  opt: AIOption;
  strategyId: string;
  slotId: string;
  color: string;
  sels: SelectionState;
  onToggleFare: (stratId: string, slotId: string, optId: string, vi: number) => void;
}) {
  const selSet = useMemo(() => {
    const keys = sels[strategyId]?.[slotId] || new Set<string>();
    const result = new Set<number>();
    keys.forEach((key) => {
      const [id, fi] = key.split(":");
      if (id === opt.id) result.add(parseInt(fi));
    });
    return result;
  }, [sels, strategyId, slotId, opt.id]);

  const anyChecked = selSet.size > 0;

  return (
    <div
      className="rounded-[7px] mb-[6px] overflow-hidden transition-all duration-150"
      style={{
        border: `1px solid ${anyChecked ? `${color}55` : "rgba(255,255,255,0.08)"}`,
        background: anyChecked ? `${color}0d` : "rgba(255,255,255,0.02)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-[7px] p-[8px_10px_4px]">
        <CarrierChip code={opt.carrier} size={18} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[5px]">
            <span className="text-[11px] font-bold text-slate-100">
              {opt.carrierName || opt.carrier}
            </span>
            {opt.totalDuration && (
              <span className="text-[9px] text-slate-500">{opt.totalDuration}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-[6px] gap-y-[1px] mt-[2px]">
            {opt.segments.map((seg, i) => (
              <span key={i} className="text-[9px] text-slate-500 font-mono">
                {i > 0 && <span className="text-gray-800 mx-[2px]">·</span>}
                <span className="text-slate-400 font-bold">{seg.flightNumber}</span>{" "}
                {tfmt(seg.departureTime)}→{tfmt(seg.arrivalTime)} {seg.origin}-{seg.destination}
              </span>
            ))}
          </div>
        </div>
        {anyChecked && (
          <span
            className="text-[8px] font-bold rounded-[10px] px-[6px] py-[1px] shrink-0"
            style={{
              color,
              background: `${color}20`,
              border: `1px solid ${color}30`,
            }}
          >
            {selSet.size} selected
          </span>
        )}
      </div>
      {/* Fare rows */}
      <div className="px-2 pb-[6px]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {opt.variants.map((v, vi) => {
          const checked = selSet.has(vi);
          return (
            <FareRow
              key={vi}
              label={v.label}
              perAdult={v.perAdult}
              refundable={v.refundable}
              checked={checked}
              onToggle={() => onToggleFare(strategyId, slotId, opt.id, vi)}
              color={color}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Chat Suggestion Block ─────────────────────────────────────────────────────

function ChatSuggestionBlock({
  slots,
  strategies,
  sels,
  onToggleFare,
}: {
  slots: AISuggestionSlot[];
  strategies: Strategy[];
  sels: SelectionState;
  onToggleFare: (stratId: string, slotId: string, optId: string, vi: number) => void;
}) {
  if (!slots?.length) return null;

  return (
    <div className="mt-[10px]">
      <div className="text-[8px] text-slate-500 tracking-[2px] uppercase mb-2 flex items-center gap-[6px]">
        <span className="text-indigo-400">✦</span>
        <span>Suggested options — check fares to add to proposal</span>
      </div>
      {slots.map((slot, si) => {
        const strat = strategies.find((s) => s.id === slot.strategyId);
        const color = strat?.color || "#818cf8";
        return (
          <div key={si} className={si < slots.length - 1 ? "mb-[10px]" : ""}>
            {slots.length > 1 && strat && (
              <div
                className="text-[8px] font-bold tracking-[1.5px] uppercase mb-1 flex items-center gap-[5px]"
                style={{ color: strat.color }}
              >
                <span
                  className="px-[6px] py-[1px] rounded-[3px]"
                  style={{
                    background: `${strat.color}20`,
                    border: `1px solid ${strat.color}30`,
                  }}
                >
                  S{strat.num}
                </span>
                {strat.slots.find((sl) => sl.id === slot.slotId)?.coverage || slot.slotId}
              </div>
            )}
            {slot.options.map((opt) => (
              <AIOptionCard
                key={opt.id}
                opt={opt}
                strategyId={slot.strategyId}
                slotId={slot.slotId}
                color={color}
                sels={sels}
                onToggleFare={onToggleFare}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Chat Message ──────────────────────────────────────────────────────────────

function ChatMsg({
  m,
  strategies,
  sels,
  onToggleFare,
}: {
  m: ChatMessage;
  strategies: Strategy[];
  sels: SelectionState;
  onToggleFare: (stratId: string, slotId: string, optId: string, vi: number) => void;
}) {
  if (m.role === "system") return null;
  const u = m.role === "user";
  return (
    <div className={`flex gap-2 mb-[14px] ${u ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-extrabold mt-[1px]"
        style={{
          background: u ? "#7c3aed" : "#111827",
          color: u ? "#ede9fe" : "#818cf8",
          border: u ? "none" : "1px solid rgba(129,140,248,0.2)",
        }}
      >
        {u ? "Y" : "✦"}
      </div>
      <div className="max-w-[92%] min-w-0">
        {m.content && (
          <div
            className="text-xs leading-relaxed whitespace-pre-wrap"
            style={{
              padding: "10px 13px",
              borderRadius: 10,
              borderTopRightRadius: u ? 2 : 10,
              borderTopLeftRadius: u ? 10 : 2,
              background: u ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${u ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)"}`,
              color: u ? "#ddd6fe" : "#94a3b8",
              marginBottom: m.suggestions ? 6 : 0,
            }}
          >
            {m.content}
          </div>
        )}
        {!u && m.suggestions && (
          <ChatSuggestionBlock
            slots={m.suggestions}
            strategies={strategies}
            sels={sels}
            onToggleFare={onToggleFare}
          />
        )}
      </div>
    </div>
  );
}

// ── Slot Tabs ─────────────────────────────────────────────────────────────────

function SlotTabs({
  strategy,
  slotCounts,
  activeSlot,
  onSlotClick,
}: {
  strategy: Strategy;
  slotCounts: Record<string, { flights: number; fares: number }>;
  activeSlot: string;
  onSlotClick: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-[6px] shrink-0"
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      {strategy.slots.map((slot) => {
        const { flights = 0, fares = 0 } = slotCounts[slot.id] || {};
        const isActive = activeSlot === slot.id;
        const isFilled = fares > 0;
        return (
          <button
            key={slot.id}
            onClick={() => onSlotClick(slot.id)}
            className="flex-1 cursor-pointer border-none p-0 bg-transparent text-left"
          >
            <div
              className="rounded-[7px] transition-all duration-150"
              style={{
                padding: "8px 10px",
                border: `1.5px ${isFilled ? "solid" : "dashed"} ${isActive ? strategy.color : isFilled ? `${strategy.color}55` : "rgba(255,255,255,0.09)"}`,
                background: isActive
                  ? `${strategy.color}15`
                  : isFilled
                    ? `${strategy.color}08`
                    : "rgba(255,255,255,0.01)",
                boxShadow: isActive ? `0 0 0 1px ${strategy.color}25` : "none",
              }}
            >
              <div
                className="text-[7px] font-bold tracking-[2px] mb-[2px] uppercase"
                style={{ color: isActive ? strategy.color : "#374155" }}
              >
                {slot.label}
              </div>
              <div
                className="text-[10px] font-semibold mb-[3px] leading-tight"
                style={{ color: isFilled ? "#e2e8f0" : "#374155" }}
              >
                {slot.coverage}
              </div>
              <div className="flex items-center gap-1">
                {isFilled ? (
                  <>
                    <span
                      className="text-[8px] font-bold rounded-[10px] px-[6px] py-[1px]"
                      style={{ color: strategy.color, background: `${strategy.color}20` }}
                    >
                      {fares} fare{fares > 1 ? "s" : ""}
                    </span>
                    <span className="text-[8px] text-slate-500">
                      {flights} flight{flights > 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-[9px]"
                    style={{
                      color: isActive ? strategy.color : "#374155",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {isActive ? "↓ select fares" : "click to activate"}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Combo Calculator ──────────────────────────────────────────────────────────

interface ComboItem {
  option: Option;
  variant: Variant;
  variantIdx: number;
}

function ComboCalc({
  strategy,
  resolveSlotItems,
}: {
  strategy: Strategy;
  resolveSlotItems: (stratId: string, slotId: string) => ComboItem[];
}) {
  const combos = useMemo(() => {
    if (strategy.slots.length === 1) return null;
    const arrays = strategy.slots.map((sl) => resolveSlotItems(strategy.id, sl.id));
    if (arrays.some((a) => a.length === 0)) return null;
    const prod = arrays.reduce(
      (acc, arr) => acc.flatMap((p) => arr.map((x) => [...p, x])),
      [[]] as ComboItem[][]
    );
    return prod
      .map((items) => ({
        items,
        total: items.reduce((s, x) => s + x.variant.perAdult, 0),
        allFlex: items.every((x) => x.variant.refundable),
      }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 12);
  }, [strategy, resolveSlotItems]);

  if (!combos || combos.length < 2) return null;
  const cheapest = combos[0].total;

  return (
    <div
      className="shrink-0 p-[10px_13px]"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.25)",
      }}
    >
      <div className="text-[8px] text-slate-600 tracking-[2px] uppercase mb-[7px] flex items-center gap-[6px]">
        <span>Combinations</span>
        <span className="bg-white/5 text-slate-500 px-[6px] py-[1px] rounded-[10px]">
          {combos.length}
        </span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {combos.map((c, ci) => {
          const isC = ci === 0;
          const delta = c.total - cheapest;
          return (
            <div
              key={ci}
              className="flex items-center gap-[5px] rounded-[5px]"
              style={{
                padding: "4px 7px",
                background: isC ? `${strategy.color}15` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isC ? `${strategy.color}40` : "rgba(255,255,255,0.04)"}`,
              }}
            >
              <span className="text-[9px] text-slate-600 w-[14px] text-right shrink-0">
                {ci + 1}
              </span>
              <div className="flex gap-1 flex-1 flex-wrap items-center">
                {c.items.map((x, ii) => (
                  <span key={ii} className="flex items-center gap-[2px]">
                    {ii > 0 && <span className="text-[8px] text-gray-800 mx-[1px]">+</span>}
                    <CarrierChip code={x.option.carrier} size={12} />
                    <span className="text-[8px] text-slate-400 font-mono">
                      {x.option.segments[0]?.flightNumber}
                    </span>
                    <span className="text-[8px] text-slate-500 max-w-[55px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {x.variant.label}
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.allFlex && (
                  <span className="text-[7px] text-emerald-400 font-semibold">FLEX</span>
                )}
                {isC && (
                  <span
                    className="text-[7px] font-bold rounded-[3px] px-[5px] py-[1px]"
                    style={{ color: strategy.color, background: `${strategy.color}20` }}
                  >
                    LOW
                  </span>
                )}
                {delta > 0 && <span className="text-[8px] text-slate-500">+{pfmt(delta)}</span>}
                <span
                  className="text-[11px] font-bold min-w-[60px] text-right"
                  style={{ color: isC ? strategy.color : "#94a3b8" }}
                >
                  {pfmt(c.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Proposal HTML Builder ─────────────────────────────────────────────────────

interface Scenario {
  id: string;
  stratNum: string;
  stratLabel: string;
  label: string;
  shortLabel: string;
  totalRaw: number;
  totalPrice: string;
  allFlex: boolean;
  tickets: {
    ticketLabel: string;
    coverage: string;
    price: string;
    refundable: boolean;
    carrier: string;
    fareTerms: FareTerms | null;
    cabinClass: string;   // "Economy", "Business", "First", "PremiumEconomy"
    brandName: string;    // "Standard", "Flex", "Classic", etc.
    flights: {
      flight: string;
      route: string;
      date: string;
      depart: string;
      arrive: string;
      departISO: string;
      arriveISO: string;
      duration: string;
      cabin: string;
      aircraft: string;
      stops: number;
      operated: string | null;
    }[];
  }[];
  rationale: string | null;
  tag: string;
  highlight: boolean;
}

function buildScenariosFromState(
  sels: SelectionState,
  aiSuggested: Record<string, Record<string, AIOption[]>>,
  strategies: Strategy[]
): Scenario[] {
  const scenarios: Scenario[] = [];

  for (const strat of strategies) {
    const slotItems: Record<
      string,
      { option: Option | AIOption; variant: Variant | AIOption["variants"][0]; price: number; slot: Slot }[]
    > = {};
    let hasAny = false;

    for (const slot of strat.slots) {
      const keys = sels[strat.id]?.[slot.id] || new Set<string>();
      if (!keys.size) continue;
      hasAny = true;

      // Collect all available options: base + AI suggested
      const aiOpts = aiSuggested[strat.id]?.[slot.id] || [];
      const items: typeof slotItems[string] = [];

      keys.forEach((key) => {
        const [optId, viStr] = key.split(":");
        const vi = parseInt(viStr);

        // Try base options first
        const baseOpt = slot.options.find((o) => o.id === optId);
        if (baseOpt) {
          const v = baseOpt.variants[vi];
          if (v) items.push({ option: baseOpt, variant: v, price: v.perAdult, slot });
          return;
        }

        // Try AI suggested
        const aiOpt = aiOpts.find((o) => o.id === optId);
        if (aiOpt) {
          const v = aiOpt.variants[vi];
          if (v) items.push({ option: aiOpt, variant: v, price: v.perAdult, slot });
        }
      });

      slotItems[slot.id] = items.sort((a, b) => a.price - b.price);
    }
    if (!hasAny) continue;

    const filledSlots = strat.slots.filter((sl) => (slotItems[sl.id] || []).length > 0);
    const slotArrays = filledSlots.map((sl) => slotItems[sl.id]);
    const product = slotArrays.reduce(
      (acc, arr) => acc.flatMap((prev) => arr.map((x) => [...prev, x])),
      [[]] as (typeof slotItems[string][0])[][]
    );

    product.forEach((combo, ci) => {
      const total = combo.reduce((s, x) => s + x.price, 0);
      const allFlex = combo.every((x) => {
        const v = x.variant as Variant | AIOption["variants"][0];
        return "refundable" in v && v.refundable;
      });

      const tickets = filledSlots.map((slot, si) => {
        const item = combo[si];
        if (!item) return null;

        const opt = item.option;
        const v = item.variant;
        const vLabel = "label" in v ? v.label : "";
        const segs = "segments" in opt ? opt.segments : [];

        return {
          ticketLabel: slot.label,
          coverage: slot.coverage,
          price: pfmt(item.price),
          refundable: "refundable" in v ? v.refundable : false,
          carrier: "carrier" in opt ? opt.carrier : "",
          fareTerms: "fareTerms" in v ? (v as Variant).fareTerms : null,
          cabinClass: "cabin" in v ? ((v as any).cabin || "Economy") : "Economy",
          brandName: "brandName" in v ? ((v as Variant).brandName || "") : "",
          flights: (segs as EnrichedSegment[]).map((seg, segIdx) => {
            const depISO = "departureTime" in seg ? seg.departureTime : "";
            const arrISO = "arrivalTime" in seg ? seg.arrivalTime : "";
            // Use per-segment cabin from variant if available, else from segment itself
            const segCabin = "cabins" in v && Array.isArray((v as any).cabins)
              ? ((v as any).cabins[segIdx] || "Economy")
              : ("cabin" in seg ? (seg as any).cabin || "Economy" : "Economy");
            // Extract per-segment brand features for amenity display
            const segBrand = "brand" in seg ? (seg as EnrichedSegment).brand : undefined;
            const segFeatures = (segBrand?.features || [])
              .filter((ft) => ft.application === "F" || ft.application === "C") // Free or Chargeable — skip "N" (not offered)
              .map((ft) => ({ name: ft.name, free: ft.application === "F", group: ft.serviceGroup || "" }));
            return {
              flight: "flightNumber" in seg ? seg.flightNumber : "",
              route: `${"origin" in seg ? seg.origin : ""} → ${"destination" in seg ? seg.destination : ""}`,
              date: dfmt(depISO),
              depart: tfmt(depISO),
              arrive: tfmt(arrISO),
              departISO: depISO,
              arriveISO: arrISO,
              duration: "durationFormatted" in seg ? seg.durationFormatted : "",
              cabin: segCabin,
              aircraft: "equipment" in seg ? seg.equipment : "",
              stops: "stops" in seg ? seg.stops : 0,
              operated:
                "operatingCarrier" in seg && seg.operatingCarrier !== seg.marketingCarrier
                  ? seg.operatingCarrier
                  : null,
              brand: segBrand?.name || "",
              features: segFeatures,
            };
          }),
        };
      }).filter(Boolean) as Scenario["tickets"];

      const carrierCodes = [...new Set(combo.map((x) => {
        const opt = x.option;
        return "carrierName" in opt ? opt.carrierName || opt.carrier : opt.carrier;
      }))];
      const flights = combo
        .map((x) => {
          const segs = "segments" in x.option ? x.option.segments : [];
          return (segs as EnrichedSegment[])[0]?.flightNumber;
        })
        .filter(Boolean)
        .join(" + ");

      scenarios.push({
        id: `${strat.id}_${ci}`,
        stratNum: strat.num,
        stratLabel: strat.label,
        label: `${carrierCodes.join(" / ")} · ${flights}`,
        shortLabel: combo
          .map((x) => {
            const segs = "segments" in x.option ? x.option.segments : [];
            const v = x.variant;
            return `${(segs as EnrichedSegment[])[0]?.flightNumber || ""} ${"label" in v ? v.label : ""}`;
          })
          .join(" + "),
        totalRaw: total,
        totalPrice: pfmt(total),
        allFlex,
        tickets,
        rationale: null,
        tag: "",
        highlight: false,
      });
    });
  }

  scenarios.sort((a, b) => a.totalRaw - b.totalRaw);

  // Auto-tag
  const tagged = new Set<number>();
  if (scenarios.length > 0) {
    scenarios[0].tag = "Best Value";
    scenarios[0].highlight = true;
    tagged.add(0);
  }
  const flexIdx = scenarios.findIndex((s, i) => s.allFlex && !tagged.has(i));
  if (flexIdx > -1) {
    scenarios[flexIdx].tag = "Most Flexible";
    tagged.add(flexIdx);
  }
  const bizIdx = scenarios.findIndex(
    (s, i) => !tagged.has(i) && /business|premiere|first|biz/i.test(s.shortLabel)
  );
  if (bizIdx > -1) {
    scenarios[bizIdx].tag = "Premium";
    tagged.add(bizIdx);
  }
  scenarios.forEach((s, i) => {
    if (!s.tag) s.tag = i === scenarios.length - 1 ? "Premium Option" : `Option ${i + 1}`;
  });

  return scenarios;
}

// ── FlySmooother Email-Compatible HTML Proposal Builder ───────────────────────
// All table-based layout, inline styles only, Georgia serif, email-client safe.

const AIRCRAFT_NAMES: Record<string, string> = {
  "333": "Airbus A330-300", "332": "Airbus A330-200", "339": "Airbus A330-900neo",
  "77W": "Boeing 777-300ER", "772": "Boeing 777-200", "773": "Boeing 777-300",
  "77L": "Boeing 777-200LR", "77F": "Boeing 777F",
  "788": "Boeing 787-8 Dreamliner", "789": "Boeing 787-9 Dreamliner", "78X": "Boeing 787-10",
  "223": "Airbus A220-300", "221": "Airbus A220-100",
  "E90": "Embraer E190", "E75": "Embraer E175", "E70": "Embraer E170", "E95": "Embraer E195",
  "295": "Embraer E195-E2", "290": "Embraer E190-E2",
  "320": "Airbus A320", "321": "Airbus A321", "319": "Airbus A319", "318": "Airbus A318",
  "32N": "Airbus A321neo", "20N": "Airbus A320neo", "19N": "Airbus A319neo",
  "32Q": "Airbus A321neo (LR)", "A321": "Airbus A321",
  "73H": "Boeing 737-800", "738": "Boeing 737-800", "739": "Boeing 737-900",
  "7M8": "Boeing 737 MAX 8", "7M9": "Boeing 737 MAX 9", "7S8": "Boeing 737 MAX 8 (200)",
  "737": "Boeing 737-700", "735": "Boeing 737-500", "734": "Boeing 737-400",
  "388": "Airbus A380-800", "359": "Airbus A350-900", "351": "Airbus A350-1000",
  "346": "Airbus A340-600", "343": "Airbus A340-300",
  "764": "Boeing 767-400", "763": "Boeing 767-300", "762": "Boeing 767-200",
  "752": "Boeing 757-200", "753": "Boeing 757-300",
  "CRJ": "Bombardier CRJ", "CR9": "Bombardier CRJ-900", "CR7": "Bombardier CRJ-700",
  "DH4": "Dash 8-Q400", "AT7": "ATR 72", "AT5": "ATR 42",
  "73J": "Boeing 737-900ER", "73G": "Boeing 737-700", "73W": "Boeing 737-700 (Winglets)",
  "781": "Boeing 787-10 Dreamliner", "782": "Boeing 787-8 Dreamliner",
  "E7W": "Embraer E175", "E75L": "Embraer E175 (Long Range)", "E75S": "Embraer E175",
  "ERJ": "Embraer ERJ-145", "ER4": "Embraer ERJ-145", "E45": "Embraer ERJ-145",
  "32S": "Airbus A320 Family", "32A": "Airbus A320",
  "32B": "Airbus A321", "744": "Boeing 747-400", "74H": "Boeing 747-8",
  "M80": "McDonnell Douglas MD-80", "M88": "McDonnell Douglas MD-88",
  "M90": "McDonnell Douglas MD-90", "717": "Boeing 717",
};

const CARRIER_FULL_NAMES: Record<string, string> = {
  AF: "Air France", KL: "KLM Royal Dutch Airlines", AY: "Finnair", DL: "Delta Air Lines",
  AA: "American Airlines", UA: "United Airlines", LH: "Lufthansa", LO: "LOT Polish Airlines",
  JU: "Air Serbia", AC: "Air Canada", OS: "Austrian Airlines", SN: "Brussels Airlines",
  LX: "Swiss International", B6: "JetBlue Airways", IB: "Iberia", BA: "British Airways",
  EK: "Emirates", QR: "Qatar Airways", TK: "Turkish Airlines", SK: "SAS",
  NH: "ANA", JL: "Japan Airlines", SQ: "Singapore Airlines", CX: "Cathay Pacific",
  VS: "Virgin Atlantic", AS: "Alaska Airlines", WN: "Southwest Airlines",
  EY: "Etihad Airways", TP: "TAP Portugal", EI: "Aer Lingus",
};

const F = "font-family:Georgia,'Times New Roman',serif;";

const AIRPORT_FULL_NAMES: Record<string, { city: string; name: string }> = {
  JFK: { city: "New York", name: "John F. Kennedy International" },
  LGA: { city: "New York", name: "LaGuardia" },
  EWR: { city: "Newark", name: "Newark Liberty International" },
  LAX: { city: "Los Angeles", name: "Los Angeles International" },
  SFO: { city: "San Francisco", name: "San Francisco International" },
  OAK: { city: "Oakland", name: "Oakland International" },
  SJC: { city: "San Jose", name: "Mineta San José International" },
  BUR: { city: "Burbank", name: "Hollywood Burbank" },
  ORD: { city: "Chicago", name: "O\u2019Hare International" },
  MDW: { city: "Chicago", name: "Midway International" },
  ATL: { city: "Atlanta", name: "Hartsfield-Jackson International" },
  DFW: { city: "Dallas", name: "Dallas/Fort Worth International" },
  DEN: { city: "Denver", name: "Denver International" },
  MIA: { city: "Miami", name: "Miami International" },
  FLL: { city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood International" },
  SEA: { city: "Seattle", name: "Seattle-Tacoma International" },
  BOS: { city: "Boston", name: "Logan International" },
  IAD: { city: "Washington", name: "Dulles International" },
  DCA: { city: "Washington", name: "Reagan National" },
  BWI: { city: "Baltimore", name: "Baltimore/Washington International" },
  PHX: { city: "Phoenix", name: "Sky Harbor International" },
  MSP: { city: "Minneapolis", name: "Minneapolis-Saint Paul International" },
  DTW: { city: "Detroit", name: "Detroit Metropolitan" },
  CLT: { city: "Charlotte", name: "Charlotte Douglas International" },
  PHL: { city: "Philadelphia", name: "Philadelphia International" },
  MCO: { city: "Orlando", name: "Orlando International" },
  SAN: { city: "San Diego", name: "San Diego International" },
  IAH: { city: "Houston", name: "George Bush Intercontinental" },
  HOU: { city: "Houston", name: "William P. Hobby" },
  TPA: { city: "Tampa", name: "Tampa International" },
  SNA: { city: "Orange County", name: "John Wayne" },
  LHR: { city: "London", name: "Heathrow" },
  LGW: { city: "London", name: "Gatwick" },
  STN: { city: "London", name: "Stansted" },
  LCY: { city: "London", name: "City" },
  CDG: { city: "Paris", name: "Charles de Gaulle" },
  ORY: { city: "Paris", name: "Orly" },
  FCO: { city: "Rome", name: "Leonardo da Vinci-Fiumicino" },
  AMS: { city: "Amsterdam", name: "Schiphol" },
  FRA: { city: "Frankfurt", name: "Frankfurt am Main" },
  MUC: { city: "Munich", name: "Franz Josef Strauss" },
  MAD: { city: "Madrid", name: "Adolfo Suárez Madrid-Barajas" },
  BCN: { city: "Barcelona", name: "Josep Tarradellas Barcelona-El Prat" },
  IST: { city: "Istanbul", name: "Istanbul" },
  DXB: { city: "Dubai", name: "Dubai International" },
  DOH: { city: "Doha", name: "Hamad International" },
  NRT: { city: "Tokyo", name: "Narita International" },
  HND: { city: "Tokyo", name: "Haneda" },
  HKG: { city: "Hong Kong", name: "Hong Kong International" },
  SIN: { city: "Singapore", name: "Changi" },
  BKK: { city: "Bangkok", name: "Suvarnabhumi" },
  ICN: { city: "Seoul", name: "Incheon International" },
  SYD: { city: "Sydney", name: "Kingsford Smith" },
  MEL: { city: "Melbourne", name: "Tullamarine" },
  YYZ: { city: "Toronto", name: "Pearson International" },
  YVR: { city: "Vancouver", name: "Vancouver International" },
  MEX: { city: "Mexico City", name: "Benito Juárez International" },
  GRU: { city: "São Paulo", name: "Guarulhos International" },
  EZE: { city: "Buenos Aires", name: "Ministro Pistarini International" },
  BUD: { city: "Budapest", name: "Ferenc Liszt International" },
  WAW: { city: "Warsaw", name: "Chopin" },
  BEG: { city: "Belgrade", name: "Nikola Tesla" },
  VIE: { city: "Vienna", name: "Schwechat" },
  ZRH: { city: "Zurich", name: "Kloten" },
  BRU: { city: "Brussels", name: "Brussels" },
  CPH: { city: "Copenhagen", name: "Kastrup" },
  HEL: { city: "Helsinki", name: "Vantaa" },
  OSL: { city: "Oslo", name: "Gardermoen" },
  LIS: { city: "Lisbon", name: "Humberto Delgado" },
  DUB: { city: "Dublin", name: "Dublin" },
  CAN: { city: "Guangzhou", name: "Baiyun International" },
  PVG: { city: "Shanghai", name: "Pudong International" },
  PEK: { city: "Beijing", name: "Capital International" },
  DEL: { city: "Delhi", name: "Indira Gandhi International" },
  BOM: { city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International" },
  JNB: { city: "Johannesburg", name: "O.R. Tambo International" },
};

function airportDisplay(iata: string): string {
  const info = AIRPORT_FULL_NAMES[iata];
  if (!info) return iata;
  // Avoid "Los Angeles Los Angeles International" — if name already starts with city, just show name
  if (info.name.toLowerCase().startsWith(info.city.toLowerCase())) return `${info.name} (${iata})`;
  return `${info.city} ${info.name} (${iata})`;
}

function airportCityIata(iata: string): string {
  const info = AIRPORT_FULL_NAMES[iata];
  return info ? `${info.city} (${iata})` : iata;
}

function cabinDisplayName(cabin: string): string {
  if (cabin === "PremiumEconomy") return "Premium Economy";
  // Handle mixed-cabin labels like "Business → Economy"
  if (cabin.includes(" → ")) {
    return cabin.split(" → ").map((c) => c.trim() === "PremiumEconomy" ? "Premium Econ" : c.trim() === "Business" ? "Biz" : c.trim() === "First" ? "First" : "Econ").join(" → ");
  }
  return cabin;
}

// On US domestic flights, "First" and "Business" are the same product.
// Normalize cabin class for comparison purposes.
function normalizeCabinForComparison(cabin: string): string {
  const c = cabin.toLowerCase();
  if (c === "first" || c === "business") return "Premium";
  if (c === "premiumeconomy") return "PremiumEconomy";
  return cabin;
}

function parseDurationMins(dur: string): number {
  const match = dur.match(/(\d+)h\s*(\d+)m/);
  if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
  const hMatch = dur.match(/(\d+)h/);
  if (hMatch) return parseInt(hMatch[1]) * 60;
  const mMatch = dur.match(/(\d+)m/);
  if (mMatch) return parseInt(mMatch[1]);
  return 0;
}

function formatDurationMins(totalMins: number): string {
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins}m`;
}

function aircraftName(code: string): string {
  return AIRCRAFT_NAMES[code] || code;
}

function carrierFullName(code: string): string {
  return CARRIER_FULL_NAMES[code] || code;
}

function fullDateFmt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function timeFmt12(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return iso?.slice(11, 16) || ""; }
}

function dayDiff(depart: string, arrive: string): string {
  try {
    const d1 = new Date(depart);
    const d2 = new Date(arrive);
    const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) {
      // Check if actually next day by comparing dates
      if (d2.getDate() !== d1.getDate() || d2.getMonth() !== d1.getMonth()) return "+1";
      return "";
    }
    return diff > 0 ? `+${diff}` : "";
  } catch { return ""; }
}

function flexBadge(): string {
  return `<span style="display:inline-block;${F}font-size:10px;font-weight:bold;color:#2e7d32;background-color:#e8f5e9;border:1px solid #c8e6c9;padding:2px 8px;border-radius:2px;letter-spacing:0.5px;">FLEX</span>`;
}

// ── Proposal Classification ─────────────────────────────────────────────────
type ProposalType = "ROUNDTRIP" | "ONE_WAY" | "MULTI_STRATEGY_FIXED" | "MULTI_STRATEGY_FLEX";

interface ProposalClassification {
  type: ProposalType;
  activeStratIds: string[];
  fixed: boolean; // every slot has ≤1 selection
}

function classifyProposal(
  sels: SelectionState,
  strategies: Strategy[]
): ProposalClassification | null {
  const activeStratIds = strategies
    .filter((s) => s.slots.some((sl) => (sels[s.id]?.[sl.id]?.size || 0) > 0))
    .map((s) => s.id);

  if (activeStratIds.length === 0) return null;

  const isFixed = activeStratIds.every((stratId) => {
    const strat = strategies.find((s) => s.id === stratId);
    return strat?.slots.every((sl) => (sels[stratId]?.[sl.id]?.size || 0) <= 1) ?? true;
  });

  const onlySingle = activeStratIds.every((id) => id === "single");
  const onlyOneways = activeStratIds.every((id) => id === "oneways");
  const hasHybrid = activeStratIds.some((id) => id.startsWith("hybrid"));
  const multiStrat = activeStratIds.length > 1 || hasHybrid;

  if (onlySingle) return { type: "ROUNDTRIP", activeStratIds, fixed: isFixed };
  if (onlyOneways) return { type: isFixed ? "ONE_WAY" : "ONE_WAY", activeStratIds, fixed: isFixed };
  if (multiStrat) return { type: isFixed ? "MULTI_STRATEGY_FIXED" : "MULTI_STRATEGY_FLEX", activeStratIds, fixed: isFixed };

  // Fallback (single strategy that's not single/oneways — treat as roundtrip-like)
  return { type: "ROUNDTRIP", activeStratIds, fixed: isFixed };
}

// ── Shared HTML building blocks ──────────────────────────────────────────────

function htmlHeader(model: StrategyModel, eyebrow: string = "Curated For You"): string {
  const routeTitle = model.routeSummary.replace(/ · /g, " &middot; ");
  return `<tr><td style="background-color:#2c2c2c;padding:44px 48px 40px 48px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${F}font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8b7355;padding-bottom:14px;">${eyebrow}</td></tr>
<tr><td style="${F}font-size:28px;color:#ffffff;line-height:1.3;padding-bottom:8px;">${routeTitle}</td></tr>
<tr><td style="${F}font-size:14px;color:#a8a8a8;font-style:italic;">${model.dateSummary} &nbsp;&middot;&nbsp; ${model.paxSummary}</td></tr>
</table></td></tr>`;
}

function htmlEmailBody(introduction?: string, bodyNote: string = ""): string {
  const introText = introduction || "<!--PLACEHOLDER:INTRO-->Loading advisor notes&hellip;";
  const introStyle = introduction ? "color:#555555;" : "color:#999999;font-style:italic;";
  return `<tr><td style="padding:38px 48px 0 48px;">
<p style="margin:0 0 18px 0;${F}font-size:15px;color:#2c2c2c;line-height:1.7;">Hi,</p>
<p style="margin:0 0 18px 0;${F}font-size:14px;${introStyle}line-height:1.8;">${introText}</p>
${bodyNote ? `<p style="margin:0 0 18px 0;${F}font-size:13px;color:#888888;line-height:1.7;font-style:italic;">${bodyNote}</p>` : ""}
<p style="margin:0 0 8px 0;${F}font-size:14px;color:#555555;line-height:1.7;">Best,<br/>Jonathan</p>
</td></tr>`;
}

function htmlDiamond(): string {
  return `<tr><td align="center" style="padding:28px 0;">
<span style="${F}font-size:14px;color:#8b7355;letter-spacing:8px;">&#9670;</span></td></tr>`;
}

function htmlTripDetailsBar(model: StrategyModel): string {
  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border:1px solid #e8e4de;">
<tr><td style="padding:12px 20px;${F}font-size:11px;color:#888888;letter-spacing:1px;text-transform:uppercase;">
${model.dateSummary} &nbsp;&middot;&nbsp; ${model.paxSummary}
</td></tr></table></td></tr>`;
}

function htmlFlightCard(f: Scenario["tickets"][0]["flights"][0], carrier: string): string {
  const plusDay = dayDiff(f.departISO, f.arriveISO);
  const arriveDisplay = timeFmt12(f.arriveISO) || f.arrive;
  const departDisplay = timeFmt12(f.departISO) || f.depart;
  const stopsText = f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
  const acName = f.aircraft ? aircraftName(f.aircraft) : "";
  const operatedNote = f.operated
    ? `<p style="margin:6px 0 0 0;${F}font-size:11px;color:#999999;font-style:italic;">Operated by ${carrierFullName(f.operated)}</p>`
    : "";
  // Cabin badge — always show cabin class
  const cabinLabel = f.cabin ? cabinDisplayName(f.cabin) : "Economy";
  const cabinBadge = ` &middot; <span style="font-size:10px;letter-spacing:0.5px;color:#8b7355;font-weight:bold;">${cabinLabel}</span>`;

  return `<tr><td style="padding:0 48px 14px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #8b7355;background-color:#fafaf8;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 4px 0;${F}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;">${fullDateFmt(f.departISO || "")}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${F}font-size:18px;font-weight:bold;color:#2c2c2c;padding-bottom:4px;">${f.route}</td>
<td style="text-align:right;${F}font-size:13px;color:#555555;">${carrierFullName(f.flight?.slice(0, 2) || carrier)} &middot; ${f.flight}${cabinBadge}</td></tr>
</table>
<p style="margin:6px 0 0 0;${F}font-size:15px;color:#2c2c2c;">${departDisplay} &rarr; ${arriveDisplay}${plusDay ? `<span style="font-size:11px;color:#b45309;font-weight:bold;">${plusDay}</span>` : ""}</p>
<p style="margin:4px 0 0 0;${F}font-size:12px;color:#888888;">${f.duration} &middot; ${stopsText}${acName ? ` &middot; ${acName}` : ""}</p>
${operatedNote}
</td></tr></table></td></tr>`;
}

/** Unified routing zone — all flights in one block with direction separators.
 *  When showCabin is false (mixed cabin packages), omit cabin from flight lines
 *  since the fare table handles per-direction cabin context. */
function htmlRoundtripRoutingZone(
  flights: Scenario["tickets"][0]["flights"],
  carrier: string,
  showCabin: boolean = true,
): string {
  if (flights.length === 0) return "";

  // Detect midpoint — switch from outbound to return
  const midIdx = flights.length === 2 ? 0 : Math.floor(flights.length / 2) - 1;

  let segments = "";
  flights.forEach((f, i) => {
    const isFirst = i === 0;
    const isReturn = i > midIdx;
    const plusDay = dayDiff(f.departISO, f.arriveISO);
    const arriveDisplay = timeFmt12(f.arriveISO) || f.arrive;
    const departDisplay = timeFmt12(f.departISO) || f.depart;
    const stopsText = f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
    const acName = f.aircraft ? aircraftName(f.aircraft) : "";
    const operatedNote = f.operated
      ? `<p style="margin:4px 0 0 0;${F}font-size:11px;color:#999999;font-style:italic;">Operated by ${carrierFullName(f.operated)}</p>`
      : "";
    const cabinLabel = showCabin ? (f.cabin ? cabinDisplayName(f.cabin) : "Economy") : "";

    // Direction separator
    if (isFirst) {
      segments += `<tr><td style="padding:0 0 6px 0;">
<p style="margin:0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Outbound &middot; ${fullDateFmt(f.departISO || "")}</p></td></tr>`;
    }
    if (isReturn && i === midIdx + 1) {
      segments += `<tr><td style="padding:16px 0 6px 0;border-top:1px dashed #d0c9be;">
<p style="margin:0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Return &middot; ${fullDateFmt(f.departISO || "")}</p></td></tr>`;
    }

    // Flight segment line
    segments += `<tr><td style="padding:4px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="${F}font-size:16px;font-weight:bold;color:#2c2c2c;width:50%;">${f.route}</td>
${cabinLabel ? `<td style="text-align:right;${F}font-size:11px;color:#8b7355;font-weight:bold;">${cabinLabel}</td>` : ""}
</tr></table>
<p style="margin:4px 0 0 0;${F}font-size:14px;color:#2c2c2c;">${departDisplay} &rarr; ${arriveDisplay}${plusDay ? `<span style="font-size:11px;color:#b45309;font-weight:bold;"> ${plusDay}</span>` : ""}</p>
<p style="margin:3px 0 0 0;${F}font-size:11px;color:#888888;">${carrierFullName(f.flight?.slice(0, 2) || carrier)} &middot; ${f.flight} &middot; ${f.duration} &middot; ${stopsText}${acName ? ` &middot; ${acName}` : ""}</p>
${operatedNote}
</td></tr>`;
  });

  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #8b7355;background-color:#fafaf8;">
<tr><td style="padding:24px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${segments}
</table>
</td></tr></table></td></tr>`;
}

function htmlFareTable(ticket: Scenario["tickets"][0]): string {
  const packageName = buildPackageName(ticket);
  const fareDetailsHtml = buildFareDetailsHtml(ticket);

  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4de;">
<tr><td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Cabin &amp; Fare</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td></tr>
<tr style="background-color:#ffffff;">
<td style="padding:12px 14px;${F}border-bottom:1px solid #e8e4de;">
<p style="margin:0 0 4px 0;${F}font-size:13px;color:#2c2c2c;font-weight:bold;">${packageName}</p>
${fareDetailsHtml}
</td>
<td style="padding:12px 14px;${F}font-size:15px;color:#2c2c2c;font-weight:bold;text-align:right;vertical-align:top;border-bottom:1px solid #e8e4de;">${ticket.price}</td></tr>
</table></td></tr>`;
}

/** Humanize raw Sabre brand feature names into client-friendly language. */
function humanizeFeature(raw: string): string {
  const map: Record<string, string> = {
    "FIRST EXCESS BAG": "1 Checked Bag",
    "1ST CHECKED BAG": "1 Checked Bag",
    "SECOND EXCESS BAG": "2 Checked Bags",
    "2ND CHECKED BAG": "2 Checked Bags",
    "CHECKED BAG FIRST": "1 Checked Bag",
    "CHECKED BAG SECOND": "2 Checked Bags",
    "CARRY ON BAG": "Carry-On Bag",
    "CARRY ON HAND BAGGAGE": "Carry-On Bag",
    "PERSONAL ITEM": "Personal Item",
    "LIE FLAT BED": "Lie-Flat Seat",
    "LIE FLAT SEAT": "Lie-Flat Seat",
    "LIE-FLAT SEAT": "Lie-Flat Seat",
    "ADVANCE SEAT SELECTION": "Seat Selection",
    "PREFERRED SEAT": "Preferred Seat",
    "SEAT SELECTION": "Seat Selection",
    "BASIC SEAT": "Standard Seat",
    "STANDARD SEAT SELECTION": "Seat Selection",
    "PREMIUM SEAT": "Premium Seat",
    "EXTRA LEGROOM": "Extra Legroom",
    "EXTRA LEG ROOM": "Extra Legroom",
    "LOUNGE ACCESS": "Lounge Access",
    "PRIORITY BOARDING": "Priority Boarding",
    "PRIORITY CHECKIN": "Priority Check-In",
    "PRIORITY CHECK IN": "Priority Check-In",
    "DEDICATED CHECK IN ZONE": "Priority Check-In",
    "WIFI": "Wi-Fi",
    "INFLIGHT WIFI": "Wi-Fi",
    "IN FLIGHT WIFI": "Wi-Fi",
    "MEAL": "Meal Included",
    "COMPLIMENTARY FOOD AND BEV": "Meals & Drinks",
    "SNACK": "Snack",
    "ALCOHOLIC BEVERAGES": "Drinks Included",
    "NON ALCOHOLIC BEVERAGES": "Non-Alcoholic Drinks",
    "FLAGSHIP CHECKIN": "Flagship Check-In",
    "MAIN CABIN EXTRA": "Main Cabin Extra",
    "PRE RESERVED SEATS": "Pre-Reserved Seat",
    "MILEAGE ACCRUAL": "Miles Earning",
    "AADVANTAGE MILES": "Miles Earning",
    "CHANGEABLE TICKET": "Free Changes",
    "UPGRADEABLE": "Upgrade Eligible",
  };
  const upper = raw.toUpperCase().trim();
  if (map[upper]) return map[upper];
  // Fallback: title case the raw name
  return raw.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(And|Or|Of|The|A)\b/g, (w) => w.toLowerCase());
}

/** Pick the most relevant features per flight for display — skip noise. */
function pickNotableFeatures(features: { name: string; free: boolean; group: string }[]): string[] {
  // Priority order: seat amenities, baggage, lounge, boarding, meals
  const priority = ["SA", "BG", "LG", "ML", "TS", "IE", "FF", "UP"];
  // Skip very generic / noisy features
  const skipPatterns = /^(PERSONAL ITEM|CARRY ON|CARRY ON HAND BAGGAGE|MILEAGE ACCRUAL|AADVANTAGE|BASIC SEAT|CHANGEABLE TICKET|NON REFUNDABLE|REFUNDABLE)$/i;

  // ── Pre-aggregate checked bags: count free & chargeable bag features
  const bagChecked = features.filter(
    (f) => f.group === "BG" && /CHECK|EXCESS BAG/i.test(f.name) && !/CARRY|PERSONAL/i.test(f.name)
  );
  const freeBags = bagChecked.filter((f) => f.free).length;
  const chargeableBags = bagChecked.filter((f) => !f.free).length;
  let bagLabel = "";
  if (freeBags > 0) {
    bagLabel = freeBags === 1 ? "1 Checked Bag" : `${freeBags}x Checked Bags`;
  } else if (chargeableBags > 0) {
    bagLabel = "Checked Bag (paid)";
  }

  const seen = new Set<string>();
  const result: string[] = [];

  // If we have an aggregated bag label, add it first (BG is high priority)
  if (bagLabel) {
    result.push(bagLabel);
    seen.add(bagLabel);
  }

  // Sort by priority group, then free before chargeable
  const sorted = [...features].sort((a, b) => {
    const ai = priority.indexOf(a.group);
    const bi = priority.indexOf(b.group);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return (a.free ? 0 : 1) - (b.free ? 0 : 1);
  });

  for (const f of sorted) {
    if (skipPatterns.test(f.name.trim())) continue;
    // Skip individual bag features — already aggregated above
    if (f.group === "BG" && /CHECK|EXCESS BAG/i.test(f.name) && !/CARRY|PERSONAL/i.test(f.name)) continue;
    const humanized = humanizeFeature(f.name);
    if (seen.has(humanized)) continue;
    seen.add(humanized);
    // Show free features as-is, chargeable as "(paid)"
    result.push(f.free ? humanized : `${humanized} (paid)`);
    if (result.length >= 4) break; // Cap at 4 per direction
  }
  return result;
}

/** Build fare details HTML — shows shared terms on one line, then per-direction amenities if they differ. */
function buildFareDetailsHtml(ticket: Scenario["tickets"][0]): string {
  const ft = ticket.fareTerms;
  const flights = ticket.flights;

  // Shared terms (refund, changes) — always show at top
  const sharedItems: string[] = [];
  if (ft) {
    sharedItems.push(ft.refundSummary);
    if (ft.changeSummary && ft.changeSummary !== "No Changes") sharedItems.push(ft.changeSummary);
  } else {
    sharedItems.push(ticket.refundable ? "Refundable" : "Non-refundable");
  }

  const termBadge = (t: string) => {
    const isGreen = /refundable|free|flex|included/i.test(t) && !/non-refundable/i.test(t);
    const isPaid = /\(paid\)/i.test(t);
    const color = isPaid ? "#999999" : isGreen ? "#2e7d32" : "#555555";
    return `<span style="${F}font-size:11px;color:${color};display:inline-block;margin-right:6px;margin-bottom:2px;">&#x2713; ${t}</span>`;
  };

  let html = `<p style="margin:0;line-height:1.7;">${sharedItems.map(termBadge).join("")}</p>`;

  // Build per-flight amenity lists from brand features
  const perFlightAmenities = flights.map((f: any) => {
    if (f.features && f.features.length > 0) {
      return pickNotableFeatures(f.features);
    }
    return [] as string[];
  });

  // Check if any per-flight data exists
  const hasPerFlight = perFlightAmenities.some((items) => items.length > 0);

  if (!hasPerFlight) {
    // Fall back to ticket-level fare terms
    const items: string[] = [];
    if (ft?.baggage) items.push(ft.baggage);
    if (ft?.seatType) items.push(ft.seatType);
    if (items.length > 0) {
      html += `<p style="margin:2px 0 0 0;line-height:1.7;">${items.map(termBadge).join("")}</p>`;
    }
    return html;
  }

  const allSameAmenities = perFlightAmenities.length <= 1 ||
    perFlightAmenities.every((items) => items.join("|") === perFlightAmenities[0].join("|"));

  if (allSameAmenities) {
    // Same amenities on all flights — show as flat list
    const items = perFlightAmenities[0] || [];
    if (items.length > 0) {
      html += `<p style="margin:2px 0 0 0;line-height:1.7;">${items.map(termBadge).join("")}</p>`;
    }
  } else {
    // Different amenities per direction — show with direction labels
    const dirLabels = flights.length === 2 ? ["Outbound", "Return"] : flights.map((f: any) => f.route || "");
    flights.forEach((_f: any, i: number) => {
      const items = perFlightAmenities[i];
      if (items.length > 0) {
        html += `<p style="margin:6px 0 0 0;${F}font-size:10px;color:#8b7355;font-weight:bold;letter-spacing:0.5px;">${dirLabels[i]}:</p>`;
        html += `<p style="margin:1px 0 0 0;line-height:1.7;">${items.map(termBadge).join("")}</p>`;
      }
    });
  }

  return html;
}

/** Build a human-readable package name from per-flight brand+cabin data.
 *  e.g. "MINT (Business) outbound · BLUE (Economy) return" or "MINT both ways" */
function buildPackageName(ticket: Scenario["tickets"][0]): string {
  const flights = ticket.flights;
  if (flights.length <= 1) {
    const f = flights[0];
    const brand = ticket.brandName || "";
    const cabin = f?.cabin ? cabinDisplayName(f.cabin) : "Economy";
    // If brand already contains the cabin word, just return brand
    if (brand && brand.toLowerCase().includes(cabin.toLowerCase())) return brand;
    return brand ? `${brand} (${cabin})` : cabin;
  }

  // Multi-segment: build per-direction descriptions
  const brandParts = (ticket.brandName || "").split(" + ");
  const perFlight = flights.map((f, i) => {
    const brand = brandParts[i]?.trim() || brandParts[0]?.trim() || "";
    const cabin = f.cabin ? cabinDisplayName(f.cabin) : "Economy";
    return { brand, cabin, route: f.route };
  });

  // Check if all the same brand+cabin
  const allSameBrand = perFlight.every((pf) => pf.brand === perFlight[0].brand);
  const allSameCabin = perFlight.every((pf) => pf.cabin === perFlight[0].cabin);

  if (allSameBrand && allSameCabin) {
    const pf = perFlight[0];
    const label = pf.brand
      ? (pf.brand.toLowerCase().includes(pf.cabin.toLowerCase()) ? pf.brand : `${pf.brand} (${pf.cabin})`)
      : pf.cabin;
    return flights.length === 2 ? `${label} both ways` : label;
  }

  // Different per direction — describe each with cabin parenthetical
  const dirLabels = flights.length === 2 ? ["outbound", "return"] : flights.map((f) => f.route);
  return perFlight.map((pf, i) => {
    if (pf.brand) {
      // If brand name already implies the cabin (e.g. "BUSINESS PROMO"), still add parenthetical
      // for clarity since different legs have different cabins
      return `${pf.brand} (${pf.cabin}) ${dirLabels[i]}`;
    }
    return `${pf.cabin} ${dirLabels[i]}`;
  }).join(" · ");
}

function htmlTicketHeader(ticket: Scenario["tickets"][0]): string {
  return `<tr><td style="padding:4px 48px 8px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #e8e4de;">
<tr><td style="${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;padding-bottom:6px;">${ticket.ticketLabel}</td>
<td style="${F}font-size:11px;color:#555555;text-align:right;padding-bottom:6px;">${ticket.coverage}</td></tr>
</table></td></tr>`;
}

function htmlMultiTicketDisclaimer(ticketCount: number, isOneWay: boolean = false): string {
  const text = isOneWay
    ? `Each leg is booked as a separate one-way ticket with independent fare rules. Changes or cancellations on one leg do not affect the other.`
    : `This itinerary comprises ${ticketCount} separate tickets. Missed connections between tickets are the passenger&rsquo;s responsibility. Luggage may require re-check between carriers.`;
  return `<tr><td style="padding:0 48px 16px 48px;">
<p style="margin:0;${F}font-size:12px;color:#555555;font-style:italic;line-height:1.7;">${text}</p></td></tr>`;
}

function htmlPricingSummary(sc: Scenario): string {
  return `<tr><td style="padding:0 48px 10px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border:1px solid #e8e4de;">
<tr><td style="padding:14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${sc.tickets.length > 1 ? sc.tickets.map((t) => `<tr><td style="${F}font-size:13px;color:#555555;padding-bottom:4px;">${t.ticketLabel} &middot; ${t.coverage}</td><td style="${F}font-size:13px;color:#2c2c2c;font-weight:bold;text-align:right;padding-bottom:4px;">${t.price}</td></tr>`).join("") : ""}
<tr><td colspan="2" style="padding:4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e8e4de;"></td></tr></table></td></tr>
<tr><td style="${F}font-size:14px;color:#2c2c2c;font-weight:bold;">Per Person</td><td style="${F}font-size:16px;color:#2c2c2c;font-weight:bold;text-align:right;">${sc.totalPrice}</td></tr>
</table></td></tr></table></td></tr>`;
}

function htmlComparisonTable(scenarios: Scenario[]): string {
  if (scenarios.length < 2) return "";
  const compRows = scenarios.map((sc, i) => {
    const bg = sc.highlight ? "#fefce8" : (i % 2 === 0 ? "#ffffff" : "#f7f6f3");
    const numStyle = sc.highlight
      ? `${F}font-size:12px;font-weight:bold;color:#8b7355;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;`
      : `${F}font-size:12px;color:#8b7355;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;`;
    // Build cabin description for the comparison row
    const ticket = sc.tickets[0];
    const cabinDesc = ticket ? buildPackageName(ticket) : "";
    return `<tr>
<td style="${numStyle}">${sc.highlight ? "&#9733;" : i + 1}</td>
<td style="${F}font-size:12px;color:#2c2c2c;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;">${cabinDesc}</td>
<td style="${F}font-size:12px;color:#2c2c2c;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;">${sc.tag}</td>
<td style="${F}font-size:13px;color:#2c2c2c;font-weight:bold;padding:9px 14px;text-align:right;background-color:${bg};border-bottom:1px solid #e8e4de;">${sc.totalPrice}</td></tr>`;
  }).join("");

  return `<tr><td style="padding:32px 48px 6px 48px;">
<p style="margin:0 0 12px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">All Options at a Glance</p></td></tr>
<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4de;">
<tr>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;width:30px;"></td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Package</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Type</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td></tr>
${compRows}
</table></td></tr>`;
}

function htmlWatchOuts(watchOuts: string[]): string {
  if (!watchOuts.length) return "";
  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff9f0;border:1px solid #e8dcc8;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b45309;font-weight:bold;">&#9888; Important Considerations</p>
${watchOuts.map(w => `<p style="margin:0 0 4px 0;${F}font-size:12px;color:#555555;line-height:1.7;padding-left:12px;border-left:2px solid #e8dcc8;">${w}</p>`).join("")}
</td></tr></table></td></tr>`;
}

function htmlRecommendation(recommendation: string): string {
  const recText = recommendation || "<!--PLACEHOLDER:RECOMMENDATION-->Loading recommendation&hellip;";
  const recStyle = recommendation ? "color:#555555;" : "color:#999999;font-style:italic;";
  return `<tr><td style="padding:0 48px 6px 48px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Recommendation</p></td></tr>
<tr><td style="padding:0 48px 20px 48px;">
<p style="margin:0;${F}font-size:13px;${recStyle}line-height:1.85;">${recText}</p></td></tr>`;
}

function htmlAdvisorNotes(advisorNotes: string): string {
  if (!advisorNotes) return "";
  return `<tr><td style="padding:0 48px 6px 48px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Advisor Notes</p></td></tr>
<tr><td style="padding:0 48px 20px 48px;">
<p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.85;">${advisorNotes}</p></td></tr>`;
}

function htmlBookingTerms(): string {
  return `<tr><td style="padding:8px 48px 6px 48px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Booking Terms</p></td></tr>
<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border:1px solid #e8e4de;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 10px 0;${F}font-size:13px;color:#2c2c2c;font-weight:bold;">Ticketing Deadline</p>
<p style="margin:0 0 14px 0;${F}font-size:12px;color:#555555;line-height:1.7;">All segments must be ticketed within 24 hours of booking or as specified by carrier fare rules.</p>
<p style="margin:0 0 6px 0;${F}font-size:12px;color:#555555;line-height:1.7;">Fares are subject to availability and may change without notice. Prices shown include base fare and taxes.</p>
</td></tr></table></td></tr>`;
}

function htmlFooter(): string {
  return `<tr><td style="background-color:#2c2c2c;padding:30px 48px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${F}font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;padding-bottom:6px;">FlySmoother</td></tr>
<tr><td style="${F}font-size:12px;color:#a09a92;font-style:italic;">Effortless travel, elevated.</td></tr>
<tr><td style="${F}font-size:10px;color:#666666;padding-top:10px;">Subject to availability &middot; Fares may change &middot; ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td></tr>
</table></td></tr>`;
}

function htmlSectionDivider(thick: boolean = false): string {
  return thick
    ? `<tr><td style="padding:16px 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:3px solid #e8e4de;"></td></tr></table></td></tr>`
    : `<tr><td align="center" style="padding:20px 0;"><span style="${F}font-size:14px;color:#8b7355;letter-spacing:8px;">&#9670;</span></td></tr>`;
}

function htmlOptionHeader(tag: string, label: string, totalPrice: string, highlight: boolean, rationale: string | null, id: string): string {
  return `<tr><td style="padding:8px 48px 6px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${F}font-size:20px;font-weight:bold;color:#2c2c2c;padding-bottom:3px;">${tag}</td></tr>
<tr><td style="${F}font-size:12px;color:#888888;padding-bottom:${highlight ? "6" : "4"}px;">
${label}${highlight ? " &#9733;" : ""} &nbsp;&middot;&nbsp; ${totalPrice} per person</td></tr>
</table></td></tr>
${rationale
    ? `<tr><td style="padding:0 48px 14px 48px;"><p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.7;font-style:italic;">${rationale}</p></td></tr>`
    : `<tr><td style="padding:0 48px 14px 48px;"><p style="margin:0;${F}font-size:13px;color:#999999;line-height:1.7;font-style:italic;"><!--PLACEHOLDER:RATIONALE_${id}-->Loading advisor notes&hellip;</p></td></tr>`}`;
}

function htmlLegHeader(eyebrow: string, route: string, date: string, optionCount: number): string {
  return `<tr><td style="padding:24px 48px 10px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2c2c2c;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 4px 0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${eyebrow}</p>
<p style="margin:0 0 4px 0;${F}font-size:18px;color:#ffffff;font-weight:bold;">${route}</p>
<p style="margin:0;${F}font-size:12px;color:#a8a8a8;">${date}${optionCount > 1 ? ` &middot; ${optionCount} options` : ""}</p>
</td></tr></table></td></tr>`;
}

function htmlStrategyCallout(text: string): string {
  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f3;border:1px solid #e8e4de;">
<tr><td style="padding:18px 24px;">
<p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.8;">${text}</p>
</td></tr></table></td></tr>`;
}

function htmlHowThisWorks(tickets: { label: string; coverage: string; carriers: string; priceRange: string; desc: string }[], cheapestTotal: string, flexTotal: string | null): string {
  const ticketRows = tickets.map((t) =>
    `<p style="margin:0 0 10px 0;${F}font-size:13px;color:#2c2c2c;line-height:1.6;"><strong>${t.label}</strong> &nbsp; ${t.coverage}<br/>
<span style="color:#555555;">${t.carriers} &middot; ${t.priceRange}</span><br/>
<span style="color:#888888;font-size:12px;">${t.desc}</span></p>`
  ).join("");

  return `<tr><td style="padding:8px 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f3;border:1px solid #e8e4de;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 14px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">How This Works</p>
${ticketRows}
<p style="margin:12px 0 0 0;${F}font-size:12px;color:#555555;line-height:1.7;">You will choose one option for each ticket. Your total will depend on the combination.</p>
<p style="margin:6px 0 0 0;${F}font-size:13px;color:#2c2c2c;font-weight:bold;">Cheapest combination: ${cheapestTotal} per person</p>
${flexTotal ? `<p style="margin:2px 0 0 0;${F}font-size:13px;color:#2e7d32;">Most flexible: ${flexTotal} per person</p>` : ""}
</td></tr></table></td></tr>`;
}

function htmlCombinationMatrix(scenarios: Scenario[]): string {
  if (scenarios.length <= 1) return "";
  // If small enough for a matrix (≤9 combos), show as grid; otherwise ranked list
  if (scenarios.length <= 9) {
    return htmlComparisonTable(scenarios);
  }
  // Top combos list
  const top = scenarios.slice(0, 5);
  const rows = top.map((sc, i) => {
    const bg = sc.highlight ? "#fefce8" : (i % 2 === 0 ? "#ffffff" : "#f7f6f3");
    return `<tr><td style="${F}font-size:12px;color:#8b7355;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;">${i + 1}</td>
<td style="${F}font-size:12px;color:#2c2c2c;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;">${sc.shortLabel}</td>
<td style="${F}font-size:12px;color:#2c2c2c;padding:9px 14px;background-color:${bg};border-bottom:1px solid #e8e4de;">${sc.tag}</td>
<td style="${F}font-size:13px;color:#2c2c2c;font-weight:bold;padding:9px 14px;text-align:right;background-color:${bg};border-bottom:1px solid #e8e4de;">${sc.totalPrice}</td></tr>`;
  }).join("");

  return `<tr><td style="padding:32px 48px 6px 48px;">
<p style="margin:0 0 12px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Top Combinations</p></td></tr>
<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4de;">
<tr>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;width:30px;"></td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Combination</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Type</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td></tr>
${rows}
</table></td></tr>`;
}

function wrapEmailShell(model: StrategyModel, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flight Options &mdash; ${model.routeSummary}</title></head><body style="margin:0;padding:0;${F}background-color:#f7f6f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f3;">
<tr><td align="center" style="padding:30px 15px;">
<table role="presentation" width="700" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;width:100%;background-color:#ffffff;">
${body}
</table></td></tr></table></body></html>`;
}

// ── Type-Specific Renderers ──────────────────────────────────────────────────

function renderRoundtrip(scenarios: Scenario[], model: StrategyModel, copy: ProposalCopy): string {
  const bodyNote = "Each option is a single ticket &mdash; one booking, one carrier relationship, full protection end to end.";
  let sections = "";

  // ── Group scenarios by physical routing ──
  // Scenarios with the same flights (same flight numbers, same times) get one
  // routing block with a multi-row fare table — instead of repeating the flight
  // card for every fare tier.
  interface RoutingGroup {
    routingKey: string;
    scenarios: Scenario[];
    flights: Scenario["tickets"][0]["flights"];
    carrier: string;
  }

  const routingGroups: RoutingGroup[] = [];
  const routingMap = new Map<string, RoutingGroup>();

  for (const sc of scenarios) {
    // Build a key from all flight numbers + departure times (physical routing identity)
    const allFlights = sc.tickets.flatMap((t) => t.flights);
    const routingKey = allFlights
      .map((f) => `${f.flight}-${f.departISO}`)
      .join("|");

    const existing = routingMap.get(routingKey);
    if (existing) {
      existing.scenarios.push(sc);
    } else {
      const group: RoutingGroup = {
        routingKey,
        scenarios: [sc],
        flights: allFlights,
        carrier: sc.tickets[0]?.carrier || "",
      };
      routingMap.set(routingKey, group);
      routingGroups.push(group);
    }
  }

  routingGroups.forEach((group, gi) => {
    if (gi > 0) sections += htmlSectionDivider();

    // Detect whether scenarios across this routing group have varying cabin combos
    // If so, omit cabin from the routing zone — let the fare table show per-direction cabin
    const hasMixedCabinPackages = (() => {
      const cabinKeys = new Set<string>();
      for (const sc of group.scenarios) {
        const key = sc.tickets.flatMap((t) => t.flights.map((f) => f.cabin || "Economy")).join("|");
        cabinKeys.add(key);
      }
      return cabinKeys.size > 1;
    })();

    if (group.scenarios.length === 1) {
      // Single scenario for this routing
      const sc = group.scenarios[0];
      sections += htmlOptionHeader(sc.tag, sc.label, sc.totalPrice, sc.highlight, sc.rationale, sc.id);
      const allFlights = sc.tickets.flatMap((t) => t.flights);
      if (allFlights.length >= 2) {
        sections += htmlRoundtripRoutingZone(allFlights, sc.tickets[0]?.carrier || "", true);
      } else {
        allFlights.forEach((f) => { sections += htmlFlightCard(f, sc.tickets[0]?.carrier || ""); });
      }
      sc.tickets.forEach((ticket) => {
        sections += htmlFareTable(ticket);
      });
    } else {
      // Multiple scenarios for the same routing
      const primary = group.scenarios[0];
      const optionLabel = `${primary.label}`;
      const priceRange = group.scenarios.length > 1
        ? `${group.scenarios[0].totalPrice} – ${group.scenarios[group.scenarios.length - 1].totalPrice}`
        : primary.totalPrice;

      sections += htmlOptionHeader(
        primary.tag,
        optionLabel,
        priceRange,
        primary.highlight,
        primary.rationale,
        primary.id
      );

      // Unified routing zone — omit cabin when packages have different cabin combos
      if (group.flights.length >= 2) {
        sections += htmlRoundtripRoutingZone(group.flights, group.carrier, !hasMixedCabinPackages);
      } else {
        group.flights.forEach((f) => { sections += htmlFlightCard(f, group.carrier); });
      }

      // Multi-row fare table — one row per fare tier
      sections += htmlMultiFareTable(group.scenarios);
    }
  });

  return wrapEmailShell(model, [
    htmlHeader(model),
    htmlEmailBody(copy.introduction, bodyNote),
    htmlDiamond(),
    htmlTripDetailsBar(model),
    sections,
    htmlComparisonTable(scenarios),
    htmlWatchOuts(copy.watchOuts || []),
    htmlRecommendation(copy.recommendation || ""),
    htmlAdvisorNotes(copy.advisorNotes || ""),
    htmlBookingTerms(),
    htmlFooter(),
  ].join(""));
}

/** Render a multi-row fare table for grouped scenarios sharing the same physical routing. */
function htmlMultiFareTable(scenarios: Scenario[]): string {
  const rows = scenarios.map((sc) => {
    const ticket = sc.tickets[0];
    if (!ticket) return "";
    const packageName = buildPackageName(ticket);
    const fareDetailsHtml = buildFareDetailsHtml(ticket);

    const isRefundable = ticket.refundable;
    const rowBg = isRefundable ? "#f7fdf7" : "#ffffff";

    return `<tr style="background-color:${rowBg};">
<td style="padding:12px 14px;${F}border-bottom:1px solid #e8e4de;">
<p style="margin:0 0 4px 0;${F}font-size:13px;color:#2c2c2c;font-weight:bold;">${packageName}</p>
${fareDetailsHtml}
</td>
<td style="padding:12px 14px;${F}font-size:15px;color:#2c2c2c;font-weight:bold;text-align:right;vertical-align:top;border-bottom:1px solid #e8e4de;">${sc.totalPrice}</td></tr>`;
  }).join("");

  return `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e4de;">
<tr><td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Package &amp; Fare</td>
<td style="background-color:#2c2c2c;padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td></tr>
${rows}
</table></td></tr>`;
}

// ── One-Way Sub-Scenario Types & Helpers ─────────────────────────────────────

interface OneWayFareTier {
  tierLabel: string;
  price: number;
  priceStr: string;
  refundable: boolean;
  fareTerms: FareTerms | null;
}

interface OneWayCabinGroup {
  cabinClass: string;
  tiers: OneWayFareTier[];
}

interface OneWayFlightOption {
  flightKey: string;
  letter: string;
  carrier: string;
  flights: Scenario["tickets"][0]["flights"];
  cabins: OneWayCabinGroup[];
  lowestPrice: number;
  lowestRefPrice: number | null;
}

interface OneWayLegData {
  coverage: string;
  legIdx: number;
  direction: string;
  date: string;
  options: OneWayFlightOption[];
  scenario: 1 | 2 | 3 | 4;
  distinctCabins: string[];
}

function extractOneWayLegs(scenarios: Scenario[]): OneWayLegData[] {
  const legMap = new Map<string, Map<string, {
    carrier: string;
    flights: Scenario["tickets"][0]["flights"];
    fares: { cabinClass: string; brandName: string; price: number; priceStr: string; refundable: boolean; fareTerms: FareTerms | null }[];
  }>>();

  for (const sc of scenarios) {
    for (const ticket of sc.tickets) {
      const legKey = ticket.coverage;
      if (!legMap.has(legKey)) legMap.set(legKey, new Map());
      const flightMap = legMap.get(legKey)!;
      const flightKey = ticket.flights.map((f) => f.flight).join("+");
      if (!flightMap.has(flightKey)) {
        flightMap.set(flightKey, { carrier: ticket.carrier, flights: ticket.flights, fares: [] });
      }
      const group = flightMap.get(flightKey)!;
      if (!group.fares.some((f) => f.cabinClass === ticket.cabinClass && f.priceStr === ticket.price)) {
        group.fares.push({
          cabinClass: ticket.cabinClass,
          brandName: ticket.brandName,
          price: parseFloat(ticket.price.replace(/[^0-9.]/g, "")),
          priceStr: ticket.price,
          refundable: ticket.refundable,
          fareTerms: ticket.fareTerms,
        });
      }
    }
  }

  const cabinOrder = ["Economy", "PremiumEconomy", "Business", "First"];
  const legs: OneWayLegData[] = [];
  let legIdx = 0;

  for (const [coverage, flightMap] of legMap) {
    const options: OneWayFlightOption[] = [];

    for (const [flightKey, data] of flightMap) {
      const cabinMap = new Map<string, OneWayFareTier[]>();
      for (const fare of data.fares) {
        const cab = fare.cabinClass || "Economy";
        if (!cabinMap.has(cab)) cabinMap.set(cab, []);
        cabinMap.get(cab)!.push({
          tierLabel: fare.brandName || (fare.refundable ? "Refundable" : "Standard"),
          price: fare.price,
          priceStr: fare.priceStr,
          refundable: fare.refundable,
          fareTerms: fare.fareTerms,
        });
      }

      const cabins: OneWayCabinGroup[] = [];
      for (const [cabinClass, tiers] of cabinMap) {
        tiers.sort((a, b) => a.price - b.price);
        cabins.push({ cabinClass, tiers });
      }
      cabins.sort((a, b) => {
        const ai = cabinOrder.indexOf(a.cabinClass);
        const bi = cabinOrder.indexOf(b.cabinClass);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      const allPrices = data.fares.map((f) => f.price);
      const refPrices = data.fares.filter((f) => f.refundable).map((f) => f.price);

      options.push({
        flightKey,
        letter: "",
        carrier: data.carrier,
        flights: data.flights,
        cabins,
        lowestPrice: Math.min(...allPrices),
        lowestRefPrice: refPrices.length > 0 ? Math.min(...refPrices) : null,
      });
    }

    options.sort((a, b) => a.lowestPrice - b.lowestPrice);

    const allCabins = new Set<string>();
    options.forEach((opt) => opt.cabins.forEach((c) => allCabins.add(c.cabinClass)));
    const distinctCabins = [...allCabins];

    const numFlights = options.length;

    // Every option has exactly 1 cabin? → Scenario 3 (compact table)
    // Normalize First/Business as equivalent (same product on domestic)
    const allSingleCabin = options.every((opt) => opt.cabins.length === 1);
    const allSameCabin = allSingleCabin && options.every(
      (opt) => normalizeCabinForComparison(opt.cabins[0].cabinClass) ===
               normalizeCabinForComparison(options[0].cabins[0]?.cabinClass || "")
    );

    // Count normalized distinct cabins
    const normalizedCabins = new Set(distinctCabins.map(normalizeCabinForComparison));

    let scenario: 1 | 2 | 3 | 4;
    if (numFlights === 1 && normalizedCabins.size <= 1) scenario = 1;
    else if (numFlights === 1 && normalizedCabins.size > 1) scenario = 2;
    else if (numFlights > 1 && (allSameCabin || allSingleCabin)) scenario = 3;
    else scenario = 4;

    const totalLegs = legMap.size;
    const direction = legIdx === 0 ? "Outbound" : legIdx === totalLegs - 1 ? "Return" : "Connecting";
    const firstFlight = options[0]?.flights[0];
    const date = firstFlight ? fullDateFmt(firstFlight.departISO) : "";

    legs.push({ coverage, legIdx, direction, date, options, scenario, distinctCabins });
    legIdx++;
  }

  return legs;
}

// ── One-Way Identity Bar (v7 style — matches roundtrip reference) ──

function htmlOneWayIdentityBar(opt: OneWayFlightOption, legDate: string): string {
  const carrier = carrierFullName(opt.carrier);
  const flightNums = opt.flights.map((f) => f.flight).join(" &middot; ");
  const numStops = opt.flights.length - 1;
  const stopsText = numStops === 0 ? "Nonstop" : `${numStops} stop${numStops > 1 ? "s" : ""}`;

  const firstFlight = opt.flights[0];
  const lastFlight = opt.flights[opt.flights.length - 1];

  const departAirport = firstFlight.route.split(" \u2192 ")[0]?.trim() || "";
  const arriveAirport = lastFlight.route.split(" \u2192 ")[1]?.trim() || "";

  // Build connection via text for connecting flights
  const viaAirports: string[] = [];
  if (opt.flights.length > 1) {
    for (let fi = 0; fi < opt.flights.length - 1; fi++) {
      const arr = opt.flights[fi].route.split(" \u2192 ")[1]?.trim() || "";
      if (arr) viaAirports.push(arr);
    }
  }
  const viaText = viaAirports.length > 0 ? ` via ${viaAirports.map((a) => airportCityIata(a)).join(", ")}` : "";

  // Short date from legDate (e.g. "Monday, July 13, 2026" → "Jul 13")
  const shortDate = legDate ? legDate.replace(/^[A-Za-z]+,\s*/, "").replace(/,\s*\d{4}$/, "").trim() : "";

  return `<tr><td style="padding:0 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2c2c2c;">
<tr><td style="padding:14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<p style="margin:0 0 2px 0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Option ${opt.letter} &nbsp;&middot;&nbsp; ${stopsText}${viaText ? ` ${viaText}` : ""}</p>
<p style="margin:0;${F}font-size:17px;font-weight:bold;color:#ffffff;">${carrier} &nbsp;<span style="font-weight:normal;font-size:14px;color:#a8a8a8;">${flightNums}</span></p>
</td>
<td style="text-align:right;">
<p style="margin:0 0 2px 0;${F}font-size:12px;color:#a8a8a8;">${shortDate}</p>
<p style="margin:0;${F}font-size:12px;font-weight:bold;color:#8b7355;">${departAirport} &rarr; ${arriveAirport}</p>
</td>
</tr>
</table></td></tr></table></td></tr>`;
}

// ── One-Way Routing Zone (v7 style — 3-column layout matching roundtrip reference) ──

function htmlOneWayRoutingZone(opt: OneWayFlightOption): string {
  let html = `<tr><td style="padding:0 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-bottom:0;background-color:#fafaf8;">
<tr><td style="padding:18px 22px 4px 22px;">`;

  opt.flights.forEach((f, fi) => {
    const isLast = fi === opt.flights.length - 1;
    const departAirport = f.route.split(" \u2192 ")[0]?.trim() || "";
    const arriveAirport = f.route.split(" \u2192 ")[1]?.trim() || "";
    const acName = aircraftName(f.aircraft);
    const plusDay = dayDiff(f.departISO, f.arriveISO);
    const stopsText = "Nonstop"; // Per-segment is always nonstop
    const cabinLabel = f.cabin ? cabinDisplayName(f.cabin) : "";

    // Segment block: 3 columns — timeline dots | details | duration
    html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="width:20px;vertical-align:top;padding-top:3px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:20px;">
<tr><td align="center"><div style="width:9px;height:9px;border-radius:50%;background-color:#8b7355;margin:0 auto;">&nbsp;</div></td></tr>
<tr><td align="center"><div style="width:1px;height:36px;background-color:#c8bfb4;margin:2px auto;">&nbsp;</div></td></tr>
<tr><td align="center"><div style="width:9px;height:9px;border-radius:50%;background-color:#8b7355;margin:0 auto;">&nbsp;</div></td></tr>
</table>
</td>
<td style="padding-left:14px;vertical-align:top;">
<p style="margin:0 0 1px 0;${F}font-size:15px;font-weight:bold;color:#2c2c2c;">${timeFmt12(f.departISO)} &nbsp;&middot;&nbsp; ${airportDisplay(departAirport)}</p>
<p style="margin:0 0 24px 0;${F}font-size:11px;color:#888888;">${f.flight}${acName ? ` &nbsp;&middot;&nbsp; ${acName}` : ""}${cabinLabel ? ` &nbsp;&middot;&nbsp; ${cabinLabel}` : ""}</p>
<p style="margin:0;${F}font-size:15px;font-weight:bold;color:#2c2c2c;">${timeFmt12(f.arriveISO)}${plusDay ? `<span style="font-size:10px;color:#b45309;font-weight:bold;">${plusDay}</span>` : ""} &nbsp;&middot;&nbsp; ${airportDisplay(arriveAirport)}</p>
</td>
<td style="text-align:right;vertical-align:middle;padding-bottom:6px;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:#2c2c2c;">${f.duration}</p>
<p style="margin:0;${F}font-size:11px;color:#888888;">${stopsText}</p>
</td>
</tr>
</table>`;

    // Layover bar between segments
    if (!isLast) {
      const nextFlight = opt.flights[fi + 1];
      const layoverMs = new Date(nextFlight.departISO).getTime() - new Date(f.arriveISO).getTime();
      const layoverMins = Math.floor(layoverMs / (1000 * 60));
      const layoverHrs = Math.floor(layoverMins / 60);
      const layoverRemMins = layoverMins % 60;
      const layoverText = layoverHrs > 0 ? `${layoverHrs}h ${layoverRemMins}m` : `${layoverMins} min`;
      const layoverCity = airportDisplay(arriveAirport);

      // Tight connection check (domestic ≤60min, international ≤90min)
      const isDomestic = departAirport.length === 3 && arriveAirport.length === 3;
      const tightThreshold = isDomestic ? 60 : 90;
      const isTight = layoverMins <= tightThreshold;

      html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 10px 34px;border-top:1px dashed #d0c9be;border-bottom:1px dashed #d0c9be;">
<tr><td style="padding:8px 0${isTight ? " 4px 0" : ""};">
<p style="margin:0;${F}font-size:12px;color:#555555;"><strong style="color:#2c2c2c;">${layoverText} layover</strong> &nbsp;&middot;&nbsp; ${layoverCity}</p>
</td></tr>`;

      if (isTight) {
        html += `<tr><td style="padding:0 0 8px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff9f0;border:1px solid #e8dcc8;">
<tr><td style="padding:8px 12px;">
<p style="margin:0;${F}font-size:11px;color:#b45309;line-height:1.6;"><strong>Tight connection.</strong> ${layoverText} is at the minimum connection time at ${airportDisplay(arriveAirport)}. If the inbound flight is delayed, onward rebooking may be needed. ${carrierFullName(opt.carrier)} will rebook automatically if the connection is missed, provided both flights are on the same ticket.</p>
</td></tr></table></td></tr>`;
      }

      html += `</table>`;
    }
  });

  html += `
</td></tr>
</table></td></tr>`;
  return html;
}

// ── One-Way Cabin Columns (v7 style — side-by-side cabin columns with fare tier rows) ──

function htmlOneWayCabinColumns(opt: OneWayFlightOption, bottomPadding: string = "32px"): string {
  const numCabins = opt.cabins.length;
  if (numCabins === 0) return "";

  // Single cabin → use row-based layout (like roundtrip reference fare table)
  if (numCabins === 1) {
    return htmlOneWaySingleCabinFareTable(opt, bottomPadding);
  }

  // Multi-cabin → column layout
  const colWidth = Math.floor(100 / numCabins);

  // Column headers with "per person, one-way" annotation
  let headerCells = "";
  opt.cabins.forEach((cab, ci) => {
    const isLast = ci === numCabins - 1;
    headerCells += `<td width="${colWidth}%" style="padding:11px 16px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;${!isLast ? "border-right:1px solid #e0dbd4;" : ""}border-bottom:1px solid #e0dbd4;background-color:#f5f4f1;">${cabinDisplayName(cab.cabinClass)} &nbsp;&middot;&nbsp; <span style="letter-spacing:0.5px;">per person</span></td>`;
  });

  // Build rows: each row is one fare tier across all cabins
  const maxTiers = Math.max(...opt.cabins.map((c) => c.tiers.length));
  let tierRows = "";

  for (let ti = 0; ti < maxTiers; ti++) {
    let rowCells = "";
    // Determine if any cabin's tier at this index is refundable (for row background)
    const anyRef = opt.cabins.some((cab) => cab.tiers[ti]?.refundable);
    const rowBg = anyRef ? "#f7fdf7" : "#ffffff";

    opt.cabins.forEach((cab, ci) => {
      const isLast = ci === numCabins - 1;
      const tier = cab.tiers[ti];
      const isLastRow = ti === maxTiers - 1;
      const borderBottom = isLastRow ? "" : "border-bottom:1px solid #e0dbd4;";

      if (!tier) {
        rowCells += `<td style="padding:14px 16px;${!isLast ? "border-right:1px solid #e0dbd4;" : ""}${borderBottom}vertical-align:top;">&nbsp;</td>`;
        return;
      }

      const isRef = tier.refundable;
      const nameColor = isRef ? "#2e7d32" : "#2c2c2c";
      const priceColor = isRef ? "#2e7d32" : "#2c2c2c";

      let cellHtml = "";
      cellHtml += `<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:${nameColor};">${tier.tierLabel}${isRef ? " &nbsp;&middot;&nbsp; Flex" : ""}</p>`;

      // Refundability subtitle
      cellHtml += `<p style="margin:0 0 8px 0;${F}font-size:11px;color:#888888;">${isRef ? "Fully refundable" : "Non-refundable"}</p>`;

      // Price
      cellHtml += `<p style="margin:0 0 6px 0;${F}font-size:20px;font-weight:bold;color:${priceColor};">${tier.priceStr}</p>`;

      // Fare rules
      if (tier.fareTerms) {
        const ft = tier.fareTerms;
        if (ft.baggage) {
          const bagColor = /no checked|carry-on only/i.test(ft.baggage) ? "#c0392b" : "#555555";
          cellHtml += `<p style="margin:0 0 2px 0;${F}font-size:11px;color:${bagColor};">${ft.baggage}</p>`;
        }
        if (ft.changePolicy === "none") {
          cellHtml += `<p style="margin:0 0 2px 0;${F}font-size:11px;color:#c0392b;">Changes not permitted</p>`;
        } else if (ft.changeSummary && ft.changeSummary !== "No Changes") {
          const chgColor = /free/i.test(ft.changeSummary) ? "#2e7d32" : "#555555";
          cellHtml += `<p style="margin:0 0 2px 0;${F}font-size:11px;color:${chgColor};">${ft.changeSummary}</p>`;
        }
        if (ft.seatType) {
          cellHtml += `<p style="margin:0 0 2px 0;${F}font-size:11px;color:#555555;">${ft.seatType}</p>`;
        }
      }

      rowCells += `<td style="padding:14px 16px;${!isLast ? "border-right:1px solid #e0dbd4;" : ""}${borderBottom}vertical-align:top;">${cellHtml}</td>`;
    });

    tierRows += `<tr style="background-color:${rowBg};">${rowCells}</tr>`;
  }

  return `<tr><td style="padding:0 48px ${bottomPadding} 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-collapse:collapse;">
<tr>${headerCells}</tr>
${tierRows}
</table></td></tr>`;
}

// ── One-Way Single Cabin Fare Table (row-based, matching roundtrip reference style) ──

function htmlOneWaySingleCabinFareTable(opt: OneWayFlightOption, bottomPadding: string = "32px"): string {
  const cab = opt.cabins[0];
  if (!cab) return "";

  // Build column header: "Cabin · per person, one-way · amenities"
  const amenities: string[] = [];
  const firstTier = cab.tiers[0];
  if (firstTier?.fareTerms?.seatType) amenities.push(firstTier.fareTerms.seatType);
  if (firstTier?.fareTerms?.baggage) amenities.push(firstTier.fareTerms.baggage);
  const amenityText = amenities.length > 0 ? ` &middot; ${amenities.join(" &middot; ")}` : "";

  let html = `<tr><td style="padding:0 48px ${bottomPadding} 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-collapse:collapse;">

<tr style="background-color:#f5f4f1;">
<td colspan="3" style="padding:9px 16px 6px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-bottom:1px solid #e0dbd4;">
${cabinDisplayName(cab.cabinClass)} &nbsp;&middot;&nbsp; per person, one-way${amenityText}
</td>
</tr>

<tr style="background-color:#fafaf8;">
<td style="padding:8px 16px;width:44%;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;"></td>
<td style="padding:8px 16px;${F}font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#888888;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;text-align:center;">Changes</td>
<td style="padding:8px 16px;${F}font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#888888;border-bottom:1px solid #e0dbd4;text-align:right;">Price</td>
</tr>`;

  cab.tiers.forEach((tier, ti) => {
    const isRef = tier.refundable;
    const isLast = ti === cab.tiers.length - 1;
    const rowBg = isRef ? "#f7fdf7" : "#ffffff";
    const nameColor = isRef ? "#2e7d32" : "#2c2c2c";
    const priceColor = isRef ? "#2e7d32" : "#2c2c2c";
    const borderBottom = isLast ? "" : "border-bottom:1px solid #e0dbd4;";

    // Package name + subtitle
    const packageName = isRef ? `${tier.tierLabel} &nbsp;&middot;&nbsp; Flex` : tier.tierLabel;
    const subtitle = isRef ? "Full refund to original payment" : "No refund if cancelled";

    // Change info
    let changeText = "&mdash;";
    if (tier.fareTerms) {
      if (tier.fareTerms.changePolicy === "free") changeText = "Free";
      else if (tier.fareTerms.changePolicy === "fee") changeText = tier.fareTerms.changeSummary || "Fee applies";
      else if (tier.fareTerms.changePolicy === "none") changeText = "Not permitted";
      else if (tier.fareTerms.changeSummary && tier.fareTerms.changeSummary !== "No Changes") changeText = tier.fareTerms.changeSummary;
    }

    html += `<tr style="background-color:${rowBg};">
<td style="padding:14px 16px;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:top;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:${nameColor};">${packageName}</p>
<p style="margin:0;${F}font-size:11px;color:#888888;">${subtitle}</p>
</td>
<td style="padding:14px 16px;${F}font-size:12px;color:#555555;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:top;text-align:center;">${changeText}</td>
<td style="padding:14px 16px;${F}font-size:20px;font-weight:bold;color:${priceColor};text-align:right;${borderBottom}vertical-align:top;">${tier.priceStr}</td>
</tr>`;
  });

  html += `</table></td></tr>`;
  return html;
}

// ── One-Way Compact Table (v3 style — Scenario 3: multiple flights, same cabin) ──

function htmlOneWayCompactTable(leg: OneWayLegData): string {
  const hasRef = leg.options.some((opt) => opt.lowestRefPrice !== null);
  const hasNonRef = leg.options.some((opt) => opt.cabins.flatMap((c) => c.tiers).some((t) => !t.refundable));
  const showTwoPriceCols = hasRef && hasNonRef;

  let html = `<tr><td style="padding:0 48px 36px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-collapse:collapse;">
<tr style="background-color:#2c2c2c;">
<td width="24" style="padding:10px 0 10px 14px;border-right:1px solid #3a3a3a;">&nbsp;</td>
<td style="padding:10px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;border-right:1px solid #3a3a3a;">Flight &amp; Arrives</td>
<td style="padding:10px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;border-right:1px solid #3a3a3a;">Duration &amp; Aircraft</td>`;

  if (showTwoPriceCols) {
    html += `<td colspan="2" style="padding:0;border-right:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td colspan="2" style="padding:7px 14px 4px 14px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7355;text-align:center;border-bottom:1px solid #3a3a3a;">Per Person</td></tr>
<tr><td width="50%" style="padding:4px 14px 8px 14px;${F}font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#a8a8a8;border-right:1px solid #3a3a3a;">Non-refundable</td>
<td style="padding:4px 14px 8px 14px;${F}font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#2e7d32;">Refundable</td></tr>
</table></td>`;
  } else {
    html += `<td style="padding:10px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td>`;
  }

  html += `</tr>`;

  leg.options.forEach((opt, oi) => {
    const bg = oi % 2 === 0 ? "#ffffff" : "#fafaf8";
    const isLast = oi === leg.options.length - 1;
    const borderBottom = isLast ? "" : "border-bottom:1px solid #e0dbd4;";

    const firstFlight = opt.flights[0];
    const lastFlight = opt.flights[opt.flights.length - 1];
    const departAirport = firstFlight.route.split(" \u2192 ")[0]?.trim() || "";
    const arriveAirport = lastFlight.route.split(" \u2192 ")[1]?.trim() || "";

    const numStops = opt.flights.length - 1;
    const stopsText = numStops === 0 ? "Nonstop" : `${numStops} stop${numStops > 1 ? "s" : ""}`;

    const departTime = timeFmt12(firstFlight.departISO);
    const arriveTime = timeFmt12(lastFlight.arriveISO);
    const plusDay = dayDiff(firstFlight.departISO, lastFlight.arriveISO);

    let totalDurMins2 = opt.flights.reduce((s: number, f: typeof opt.flights[0]) => s + parseDurationMins(f.duration), 0);
    for (let _fi2 = 0; _fi2 < opt.flights.length - 1; _fi2++) {
      const layMs2 = new Date(opt.flights[_fi2 + 1].departISO).getTime() - new Date(opt.flights[_fi2].arriveISO).getTime();
      if (layMs2 > 0) totalDurMins2 += Math.floor(layMs2 / (1000 * 60));
    }
    const totalDuration = formatDurationMins(totalDurMins2);

    const carrier = carrierFullName(opt.carrier);
    const flightNums = opt.flights.map((f) => f.flight).join(" + ");
    const acNames = [...new Set(opt.flights.map((f) => aircraftName(f.aircraft)).filter(Boolean))];
    const acText = acNames.join(" / ");

    const cabinName = opt.cabins[0] ? cabinDisplayName(opt.cabins[0].cabinClass) : "";
    const seatInfo = opt.cabins[0]?.tiers[0]?.fareTerms?.seatType;
    const bagInfo = opt.cabins[0]?.tiers[0]?.fareTerms?.baggage;

    const nonRefTier = opt.cabins.flatMap((c) => c.tiers).find((t) => !t.refundable);
    const refTier = opt.cabins.flatMap((c) => c.tiers).find((t) => t.refundable);

    html += `<tr style="background-color:${bg};">
<td style="padding:18px 0 18px 14px;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:middle;">
<span style="${F}font-size:12px;font-weight:bold;color:#8b7355;">${opt.letter}</span></td>
<td style="padding:18px 14px;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:top;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:#2c2c2c;">${carrier} &middot; ${flightNums}</p>
<p style="margin:0 0 8px 0;${F}font-size:12px;color:#888888;">${cabinName}${seatInfo ? ` &middot; ${seatInfo}` : ""}</p>
<p style="margin:0 0 1px 0;${F}font-size:16px;font-weight:bold;color:#2c2c2c;">${departTime} &rarr; ${arriveTime}${plusDay ? `<span style="font-size:10px;color:#b45309;font-weight:bold;">${plusDay}</span>` : ""}</p>
<p style="margin:0;${F}font-size:11px;font-weight:bold;color:#8b7355;">Arrives ${airportCityIata(arriveAirport)}</p>
</td>
<td style="padding:18px 14px;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:top;">
<p style="margin:0 0 2px 0;${F}font-size:12px;color:#555555;">${totalDuration}</p>
<p style="margin:0 0 2px 0;${F}font-size:11px;color:#888888;">${stopsText}${acText ? ` &middot; ${acText}` : ""}</p>
${bagInfo ? `<p style="margin:0;${F}font-size:11px;color:#888888;">${bagInfo}</p>` : ""}
</td>`;

    if (showTwoPriceCols) {
      html += `<td style="padding:18px 14px;border-right:1px solid #e0dbd4;${borderBottom}vertical-align:top;text-align:center;">
${nonRefTier ? `<p style="margin:0 0 3px 0;${F}font-size:18px;font-weight:bold;color:#2c2c2c;">${nonRefTier.priceStr}</p><p style="margin:0;${F}font-size:10px;color:#888888;">${nonRefTier.tierLabel}</p>` : `<p style="margin:0;${F}font-size:12px;color:#888888;">&mdash;</p>`}
</td>
<td style="padding:18px 14px;${borderBottom}vertical-align:top;text-align:center;">
${refTier ? `<p style="margin:0 0 3px 0;${F}font-size:18px;font-weight:bold;color:#2e7d32;">${refTier.priceStr}</p><p style="margin:0;${F}font-size:10px;color:#888888;">${refTier.tierLabel}</p>` : `<p style="margin:0;${F}font-size:12px;color:#888888;">&mdash;</p>`}
</td>`;
    } else {
      const displayTier = nonRefTier || refTier;
      html += `<td style="padding:18px 14px;${borderBottom}vertical-align:top;text-align:center;">
${displayTier ? `<p style="margin:0 0 3px 0;${F}font-size:18px;font-weight:bold;color:${displayTier.refundable ? "#2e7d32" : "#2c2c2c"};">${displayTier.priceStr}</p><p style="margin:0;${F}font-size:10px;color:#888888;">${displayTier.tierLabel}</p>` : ""}
</td>`;
    }

    html += `</tr>`;
  });

  html += `</table></td></tr>`;
  return html;
}

// ── One-Way Pricing Combinations Table (v3 style — A+D, B+D format) ──

function htmlOneWayPricingCombinations(legs: OneWayLegData[]): string {
  if (legs.length < 2) return "";

  // For 3+ legs, show simplified pricing ranges
  if (legs.length > 2) {
    const legRanges = legs.map((leg) => {
      const prices = leg.options.map((o) => o.lowestPrice);
      return `${leg.coverage} from ${pfmt(Math.min(...prices))}`;
    });
    return `<tr><td style="padding:0 48px 28px 48px;border-top:2px solid #eeebe5;">
<p style="margin:28px 0 14px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Pricing Summary</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border:1px solid #e8e4de;">
<tr><td style="padding:14px 20px;">
<p style="margin:0 0 6px 0;${F}font-size:13px;color:#555555;line-height:1.7;">Your total will depend on the combination you choose.</p>
<p style="margin:0;${F}font-size:12px;color:#888888;">${legRanges.join(" &nbsp;&middot;&nbsp; ")}</p>
</td></tr></table></td></tr>`;
  }

  // 2-leg case: detailed combination table
  const leg1 = legs[0];
  const leg2 = legs[1];

  const hasNonRef = leg1.options.some((o) => o.cabins.flatMap((c) => c.tiers).some((t) => !t.refundable)) &&
    leg2.options.some((o) => o.cabins.flatMap((c) => c.tiers).some((t) => !t.refundable));
  const hasRef = leg1.options.some((o) => o.lowestRefPrice !== null) &&
    leg2.options.some((o) => o.lowestRefPrice !== null);
  const showBothCols = hasNonRef && hasRef;

  interface ComboRow { label: string; desc: string; nonRef: number | null; ref: number | null; }
  const combos: ComboRow[] = [];

  for (const opt1 of leg1.options) {
    for (const opt2 of leg2.options) {
      const nrTiers1 = opt1.cabins.flatMap((c) => c.tiers).filter((t) => !t.refundable);
      const nrTiers2 = opt2.cabins.flatMap((c) => c.tiers).filter((t) => !t.refundable);
      const rTiers1 = opt1.cabins.flatMap((c) => c.tiers).filter((t) => t.refundable);
      const rTiers2 = opt2.cabins.flatMap((c) => c.tiers).filter((t) => t.refundable);

      const nonRefTotal = nrTiers1.length > 0 && nrTiers2.length > 0
        ? Math.min(...nrTiers1.map((t) => t.price)) + Math.min(...nrTiers2.map((t) => t.price))
        : null;
      const refTotal = rTiers1.length > 0 && rTiers2.length > 0
        ? Math.min(...rTiers1.map((t) => t.price)) + Math.min(...rTiers2.map((t) => t.price))
        : null;

      const carrier1 = carrierFullName(opt1.carrier);
      const carrier2 = carrierFullName(opt2.carrier);
      const arrive1 = opt1.flights[opt1.flights.length - 1].route.split(" \u2192 ")[1]?.trim() || "";
      const depart2 = opt2.flights[0].route.split(" \u2192 ")[0]?.trim() || "";

      let desc: string;
      if (arrive1 === depart2 && opt1.carrier === opt2.carrier) {
        desc = `${carrier1} ${airportCityIata(arrive1)} &rarr; ${airportCityIata(arrive1)} &nbsp;(same airport both ways)`;
      } else if (arrive1 === depart2) {
        desc = `${carrier1} / ${carrier2} via ${airportCityIata(arrive1)} &nbsp;(same airport)`;
      } else {
        desc = `${carrier1} to ${airportCityIata(arrive1)} &middot; ${carrier2} from ${airportCityIata(depart2)}`;
      }

      combos.push({ label: `${opt1.letter} + ${opt2.letter}`, desc, nonRef: nonRefTotal, ref: refTotal });
    }
  }

  combos.sort((a, b) => (a.nonRef || a.ref || 0) - (b.nonRef || b.ref || 0));
  const displayCombos = combos.length > 8 ? combos.slice(0, 8) : combos;

  let html = `<tr><td style="padding:0 48px 0 48px;border-top:2px solid #eeebe5;">
<p style="margin:28px 0 14px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Pricing Summary</p>
</td></tr>
<tr><td style="padding:0 48px 28px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-collapse:collapse;">
<tr style="background-color:#2c2c2c;">
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;border-right:1px solid #3a3a3a;">Combination</td>`;

  if (showBothCols) {
    html += `<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#a8a8a8;text-align:right;border-right:1px solid #3a3a3a;">Non-refundable</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#2e7d32;text-align:right;">Refundable</td>`;
  } else {
    html += `<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per Person</td>`;
  }

  html += `</tr>`;

  displayCombos.forEach((combo, ci) => {
    const bg = ci % 2 === 0 ? "#fefefe" : "#fafaf8";
    const isLast = ci === displayCombos.length - 1;
    const bb = isLast ? "" : "border-bottom:1px solid #e0dbd4;";

    html += `<tr style="background-color:${bg};">
<td style="padding:12px 14px;${F}font-size:13px;color:#2c2c2c;${showBothCols ? "border-right:1px solid #e0dbd4;" : ""}${bb}">
<span style="font-weight:bold;color:#8b7355;">${combo.label}</span>
<span style="color:#888888;font-size:11px;"> &nbsp;${combo.desc}</span></td>`;

    if (showBothCols) {
      html += `<td style="padding:12px 14px;${F}font-size:14px;font-weight:bold;color:#2c2c2c;text-align:right;border-right:1px solid #e0dbd4;${bb}">${combo.nonRef ? pfmt(combo.nonRef) : "&mdash;"}</td>
<td style="padding:12px 14px;${F}font-size:14px;font-weight:bold;color:#2e7d32;text-align:right;${bb}">${combo.ref ? pfmt(combo.ref) : "&mdash;"}</td>`;
    } else {
      const price = combo.nonRef || combo.ref;
      html += `<td style="padding:12px 14px;${F}font-size:14px;font-weight:bold;color:#2c2c2c;text-align:right;${bb}">${price ? pfmt(price) : "&mdash;"}</td>`;
    }

    html += `</tr>`;
  });

  // Footer note
  html += `<tr style="background-color:#fef9f4;">
<td colspan="${showBothCols ? 3 : 2}" style="padding:12px 14px;">
<p style="margin:0;${F}font-size:11px;color:#8b7355;font-style:italic;">${combos.length > displayCombos.length ? `Showing ${displayCombos.length} of ${combos.length} combinations. ` : "All combinations available &mdash; "}Reply with any outbound + return letter and I&rsquo;ll confirm pricing and book.</p>
</td></tr>`;

  html += `</table></td></tr>`;
  return html;
}

// ── One-Way Quick Reference Table (for 3+ options across legs) ──

function htmlOneWayQuickReference(legs: OneWayLegData[]): string {
  const allOptions = legs.flatMap((leg) => leg.options);
  if (allOptions.length < 3) return "";

  let html = `<tr><td style="padding:24px 48px 6px 48px;">
<p style="margin:0 0 12px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">All Options at a Glance</p>
</td></tr>
<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-collapse:collapse;">
<tr style="background-color:#2c2c2c;">
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;width:30px;"></td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Flight</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Route</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;">Time</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#e8e4de;text-align:right;">From (non-ref)</td>
</tr>`;

  let rowIdx = 0;
  for (const leg of legs) {
    for (const opt of leg.options) {
      const firstFlight = opt.flights[0];
      const lastFlight = opt.flights[opt.flights.length - 1];
      const numStops = opt.flights.length - 1;
      const stopsText = numStops === 0 ? "Nonstop" : `${numStops} stop`;
      const departAirport = firstFlight.route.split(" \u2192 ")[0]?.trim() || "";
      const arriveAirport = lastFlight.route.split(" \u2192 ")[1]?.trim() || "";

      // Use segment durations (timezone-safe) instead of timestamp subtraction
      let totalDurMinsQR = opt.flights.reduce((s2: number, f2: typeof opt.flights[0]) => s2 + parseDurationMins(f2.duration), 0);
      for (let _fi3 = 0; _fi3 < opt.flights.length - 1; _fi3++) {
        const layMs3 = new Date(opt.flights[_fi3 + 1].departISO).getTime() - new Date(opt.flights[_fi3].arriveISO).getTime();
        if (layMs3 > 0) totalDurMinsQR += Math.floor(layMs3 / (1000 * 60));
      }
      const totalDuration = formatDurationMins(totalDurMinsQR);

      const carrier = carrierFullName(opt.carrier);
      const nonRefTier = opt.cabins.flatMap((c) => c.tiers).find((t) => !t.refundable);
      const cheapestTier = opt.cabins.flatMap((c) => c.tiers).sort((a, b) => a.price - b.price)[0];
      const displayTier = nonRefTier || cheapestTier;
      const cabinName = opt.cabins[0] ? cabinDisplayName(opt.cabins[0].cabinClass) : "";

      // Check for tight connections
      let hasTight = false;
      for (let fi = 0; fi < opt.flights.length - 1; fi++) {
        const layoverMs = new Date(opt.flights[fi + 1].departISO).getTime() - new Date(opt.flights[fi].arriveISO).getTime();
        if (layoverMs / (1000 * 60) <= 60) hasTight = true;
      }

      const bg = rowIdx % 2 === 0 ? "#ffffff" : "#fafaf8";

      html += `<tr style="background-color:${bg};">
<td style="padding:9px 14px;${F}font-size:12px;font-weight:bold;color:#8b7355;border-bottom:1px solid #e0dbd4;">${opt.letter}</td>
<td style="padding:9px 14px;${F}border-bottom:1px solid #e0dbd4;">
<span style="font-size:12px;font-weight:bold;color:#2c2c2c;">${carrier}</span><br/>
<span style="font-size:11px;color:#888888;">${stopsText} &middot; ${totalDuration}</span></td>
<td style="padding:9px 14px;${F}font-size:12px;color:#2c2c2c;border-bottom:1px solid #e0dbd4;">
${departAirport}&rarr;${arriveAirport}${hasTight ? ` <span style="color:#b45309;">&#9888;</span>` : ""}</td>
<td style="padding:9px 14px;${F}font-size:12px;color:#2c2c2c;border-bottom:1px solid #e0dbd4;">${timeFmt12(firstFlight.departISO)}</td>
<td style="padding:9px 14px;${F}font-size:13px;font-weight:bold;color:#2c2c2c;text-align:right;border-bottom:1px solid #e0dbd4;">
${displayTier ? displayTier.priceStr : "&mdash;"}<br/>
<span style="font-size:10px;font-weight:normal;color:#888888;">${cabinName}</span></td></tr>`;

      rowIdx++;
    }
  }

  html += `</table></td></tr>`;
  return html;
}

// ── One-Way How to Reply Block ──

function htmlOneWayHowToReply(legs: OneWayLegData[]): string {
  const hasMultiCabin = legs.some((l) => l.scenario === 2 || l.scenario === 4);
  const hasMultiLegs = legs.length > 1;

  let replyText: string;
  if (hasMultiLegs && hasMultiCabin) {
    replyText = "Reply with the option letters, cabin, and fare tier for each leg &mdash; for example, <strong>&ldquo;A (Business, Standard) + D (Economy, Flex)&rdquo;</strong>";
  } else if (hasMultiLegs) {
    replyText = "Reply with the option letters for each leg &mdash; for example, <strong>&ldquo;A + D&rdquo;</strong> for the cheapest combination, or <strong>&ldquo;B + D, refundable&rdquo;</strong> if you&rsquo;d like flexibility.";
  } else if (hasMultiCabin) {
    replyText = "Reply with the option letter, cabin, and fare tier &mdash; for example, <strong>&ldquo;B, First Class, Standard&rdquo;</strong> or <strong>&ldquo;C, Economy, Flex.&rdquo;</strong>";
  } else {
    replyText = "Reply with the option letter &mdash; for example, <strong>&ldquo;Option B, refundable&rdquo;</strong> or <strong>&ldquo;A, non-refundable.&rdquo;</strong>";
  }

  return `<tr><td style="padding:0 48px 28px 48px;${!hasMultiLegs ? "border-top:2px solid #eeebe5;" : ""}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${!hasMultiLegs ? "28" : "0"}px;background-color:#fafaf8;border-left:3px solid #e0dbd4;">
<tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px 0;${F}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">How to Reply</p>
<p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.8;">${replyText}</p>
</td></tr></table></td></tr>`;
}

// ── Main One-Way Renderer ────────────────────────────────────────────────────

function renderOneWay(scenarios: Scenario[], model: StrategyModel, copy: ProposalCopy, fixed: boolean): string {
  // Fixed case (single selection per leg) — show as resolved itinerary
  if (fixed && scenarios.length === 1) {
    const sc = scenarios[0];
    const bodyNote = "Your itinerary has been assembled below. Each leg is on its own ticket for maximum flexibility.";
    let sections = "";

    sc.tickets.forEach((ticket) => {
      if (sc.tickets.length > 1) sections += htmlTicketHeader(ticket);
      ticket.flights.forEach((f) => { sections += htmlFlightCard(f, ticket.carrier); });
      sections += htmlFareTable(ticket);
    });

    sections += htmlMultiTicketDisclaimer(sc.tickets.length, true);
    sections += htmlPricingSummary(sc);

    return wrapEmailShell(model, [
      htmlHeader(model),
      htmlEmailBody(copy.introduction, bodyNote),
      htmlDiamond(),
      htmlTripDetailsBar(model),
      sections,
      htmlWatchOuts(copy.watchOuts || []),
      htmlRecommendation(copy.recommendation || ""),
      htmlAdvisorNotes(copy.advisorNotes || ""),
      htmlBookingTerms(),
      htmlFooter(),
    ].join(""));
  }

  // Extract per-leg data from Cartesian product scenarios
  const legs = extractOneWayLegs(scenarios);

  // Assign letters sequentially across all legs (A, B, C for leg 1; D, E, F for leg 2; etc.)
  let letterIdx = 0;
  for (const leg of legs) {
    for (const opt of leg.options) {
      opt.letter = String.fromCharCode(65 + letterIdx++);
    }
  }

  const bodyNote = legs.length > 1
    ? "Here are your options for each leg. Pick one flight per leg &mdash; I&rsquo;ll combine them into your final booking."
    : `Here ${legs[0].options.length === 1 ? "is the option" : `are ${legs[0].options.length} options`} for this flight. Each is shown with its routing and fare tiers so you can compare at a glance.`;

  let sections = "";

  for (const leg of legs) {
    // Leg divider
    if (leg.legIdx > 0) {
      sections += `<tr><td style="padding:0 48px;border-top:2px solid #eeebe5;"></td></tr>`;
    }

    // Leg header
    const directionLabel = legs.length === 1
      ? `Outbound &middot; ${leg.date}`
      : `Leg ${leg.legIdx + 1} of ${legs.length} &middot; ${leg.direction} &middot; ${leg.date}`;

    sections += `<tr><td style="padding:${leg.legIdx > 0 ? "28" : "0"}px 48px 24px 48px;">
<p style="margin:0 0 3px 0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${directionLabel}</p>
<p style="margin:0;${F}font-size:22px;font-weight:bold;color:#2c2c2c;">${leg.coverage}</p>
</td></tr>`;

    // Render based on sub-scenario
    if (leg.scenario === 3) {
      // Scenario 3: Compact table (v3 style) — multiple flights, same cabin
      sections += htmlOneWayCompactTable(leg);
    } else {
      // Scenarios 1, 2, 4: Block layout (v6 style) — identity bar + routing zone + cabin columns
      for (const opt of leg.options) {
        sections += htmlOneWayIdentityBar(opt, leg.date);
        sections += htmlOneWayRoutingZone(opt);
        const isLastOpt = leg.options.indexOf(opt) === leg.options.length - 1;
        sections += htmlOneWayCabinColumns(opt, isLastOpt ? "36px" : "32px");
      }
    }
  }

  // Pricing combinations table (for multi-leg one-ways)
  if (legs.length >= 2) {
    sections += htmlOneWayPricingCombinations(legs);
  }

  // Quick reference table (for 3+ total options)
  const totalOptions = legs.reduce((s, l) => s + l.options.length, 0);
  if (totalOptions >= 3) {
    sections += htmlOneWayQuickReference(legs);
  }

  // How to reply block
  sections += htmlOneWayHowToReply(legs);

  // Multi-ticket disclaimer
  sections += htmlMultiTicketDisclaimer(legs.length, true);

  return wrapEmailShell(model, [
    htmlHeader(model),
    htmlEmailBody(copy.introduction, bodyNote),
    htmlDiamond(),
    htmlTripDetailsBar(model),
    sections,
    htmlWatchOuts(copy.watchOuts || []),
    htmlRecommendation(copy.recommendation || ""),
    htmlAdvisorNotes(copy.advisorNotes || ""),
    htmlBookingTerms(),
    htmlFooter(),
  ].join(""));
}

// ── Multi-Strategy Data Extraction ────────────────────────────────────────────

interface MsTicketOption {
  flightKey: string;      // Unique routing key (flight numbers joined)
  carrier: string;
  carriers: string[];     // All unique carrier codes
  flights: Scenario["tickets"][0]["flights"];
  fares: {
    cabinClass: string;
    brandName: string;
    price: number;
    priceStr: string;
    refundable: boolean;
    fareTerms: FareTerms | null;
  }[];
}

interface MsTicketGroup {
  ticketLabel: string;    // "Ticket 1 of 2"
  ticketIdx: number;
  coverage: string;       // "JFK → MXP · CDG → JFK"
  isRoundtrip: boolean;   // True if coverage contains · (multi-segment)
  options: MsTicketOption[];
}

function extractMsTicketGroups(scenarios: Scenario[]): MsTicketGroup[] {
  // Group by ticket label, then by unique routing within each ticket
  const ticketMap = new Map<string, { coverage: string; routingMap: Map<string, MsTicketOption> }>();
  const ticketOrder: string[] = [];

  for (const sc of scenarios) {
    for (const ticket of sc.tickets) {
      if (!ticketMap.has(ticket.ticketLabel)) {
        ticketMap.set(ticket.ticketLabel, { coverage: ticket.coverage, routingMap: new Map() });
        ticketOrder.push(ticket.ticketLabel);
      }
      const group = ticketMap.get(ticket.ticketLabel)!;
      const flightKey = ticket.flights.map((f) => f.flight).join("+");

      if (!group.routingMap.has(flightKey)) {
        group.routingMap.set(flightKey, {
          flightKey,
          carrier: ticket.carrier,
          carriers: [ticket.carrier],
          flights: ticket.flights,
          fares: [],
        });
      }

      const opt = group.routingMap.get(flightKey)!;
      if (!opt.carriers.includes(ticket.carrier)) opt.carriers.push(ticket.carrier);

      // Dedupe fares by cabin+price+refundability
      const fareKey = `${ticket.cabinClass}_${ticket.price}_${ticket.refundable}`;
      if (!opt.fares.some((f) => `${f.cabinClass}_${f.priceStr}_${f.refundable}` === fareKey)) {
        opt.fares.push({
          cabinClass: ticket.cabinClass,
          brandName: ticket.brandName,
          price: parseFloat(ticket.price.replace(/[^0-9.]/g, "")),
          priceStr: ticket.price,
          refundable: ticket.refundable,
          fareTerms: ticket.fareTerms,
        });
      }
    }
  }

  return ticketOrder.map((label, idx) => {
    const group = ticketMap.get(label)!;
    const options = Array.from(group.routingMap.values());
    options.forEach((opt) => opt.fares.sort((a, b) => a.price - b.price));
    options.sort((a, b) => Math.min(...a.fares.map((f) => f.price)) - Math.min(...b.fares.map((f) => f.price)));
    const isRoundtrip = group.coverage.includes("·") || group.coverage.includes("↔") || group.coverage.includes("harr");
    return { ticketLabel: label, ticketIdx: idx, coverage: group.coverage, isRoundtrip, options };
  });
}

// ── Multi-Strategy: Trip Architecture Block ──────────────────────────────────

function htmlTripArchitectureBlock(ticketGroups: MsTicketGroup[], model: StrategyModel): string {
  // Extract city sequence from all tickets in order
  interface CityNode { name: string; iata: string; date: string; }
  interface LegArrow { ticketIdx: number; ticketLabel: string; isSolid: boolean; }

  const cities: CityNode[] = [];
  const arrows: LegArrow[] = [];

  for (const tg of ticketGroups) {
    const firstOpt = tg.options[0];
    if (!firstOpt) continue;

    for (let fi = 0; fi < firstOpt.flights.length; fi++) {
      const f = firstOpt.flights[fi];
      const depIata = f.route.split(" \u2192 ")[0]?.trim() || "";
      const arrIata = f.route.split(" \u2192 ")[1]?.trim() || "";

      // Add departure city if not already the last city
      if (cities.length === 0 || cities[cities.length - 1].iata !== depIata) {
        cities.push({ name: airportCityIata(depIata).replace(` (${depIata})`, ""), iata: depIata, date: f.date });
      }

      // Arrow
      const isSolid = tg.ticketIdx === 0; // Ticket 1 = solid, others = dashed
      arrows.push({ ticketIdx: tg.ticketIdx, ticketLabel: tg.ticketLabel.replace(/ of \d+/, ""), isSolid });

      // Add arrival city
      cities.push({ name: airportCityIata(arrIata).replace(` (${arrIata})`, ""), iata: arrIata, date: f.date });
    }
  }

  if (cities.length < 2) return "";

  // Deduplicate consecutive same-city entries (keep last to get latest date)
  const dedupedCities: CityNode[] = [cities[0]];
  const dedupedArrows: LegArrow[] = [];
  let arrowIdx = 0;
  for (let ci = 1; ci < cities.length; ci++) {
    if (cities[ci].iata === dedupedCities[dedupedCities.length - 1].iata) {
      dedupedCities[dedupedCities.length - 1] = cities[ci]; // Update date
    } else {
      if (arrowIdx < arrows.length) dedupedArrows.push(arrows[arrowIdx]);
      dedupedCities.push(cities[ci]);
    }
    arrowIdx++;
  }

  const numCols = dedupedCities.length + dedupedArrows.length;
  const cityWidth = Math.floor(60 / dedupedCities.length);
  const arrowWidth = Math.floor(40 / Math.max(dedupedArrows.length, 1));

  let mapCells = "";
  for (let ci = 0; ci < dedupedCities.length; ci++) {
    const c = dedupedCities[ci];
    mapCells += `<td style="text-align:center;width:${cityWidth}%;">
<p style="margin:0 0 4px 0;${F}font-size:13px;font-weight:bold;color:#2c2c2c;">${c.name}</p>
<p style="margin:0;${F}font-size:10px;color:#8b7355;font-weight:bold;">${c.iata}</p>
<p style="margin:4px 0 0 0;${F}font-size:9px;color:#888888;">${c.date}</p>
</td>`;

    // Arrow after city (if not last)
    if (ci < dedupedArrows.length) {
      const a = dedupedArrows[ci];
      const lineColor = a.isSolid ? "#8b7355" : "#aaaaaa";
      const lineStyle = a.isSolid ? "solid" : "dashed";
      const labelColor = a.isSolid ? "#8b7355" : "#555555";

      mapCells += `<td style="text-align:center;width:${arrowWidth}%;vertical-align:middle;">
<p style="margin:0 0 3px 0;${F}font-size:9px;color:${labelColor};font-weight:bold;letter-spacing:1px;text-transform:uppercase;">${a.ticketLabel}</p>
<div style="border-top:2px ${lineStyle} ${lineColor};position:relative;height:2px;">
<span style="${F}font-size:11px;color:${lineColor};position:absolute;right:-4px;top:-8px;">&rarr;</span>
</div>
</td>`;
    }
  }

  // Ticket legend
  let legendCells = "";
  for (let ti = 0; ti < ticketGroups.length; ti++) {
    const tg = ticketGroups[ti];
    const isSolid = ti === 0;
    const lineSymbol = isSolid
      ? `<span style="color:#8b7355;">&#9135;&#9135;</span>`
      : `<span style="color:#aaa;">- - -</span>`;
    const typeLabel = tg.isRoundtrip ? "Open-jaw roundtrip" : "Internal one-way";
    const borderLeft = ti > 0 ? "border-left:1px solid #e8e4de;padding-left:12px;" : "padding-right:12px;";

    legendCells += `<td style="width:${Math.floor(100 / ticketGroups.length)}%;${borderLeft}vertical-align:top;">
<p style="margin:0 0 3px 0;${F}font-size:11px;font-weight:bold;color:#2c2c2c;">${lineSymbol}&ensp;${tg.ticketLabel.replace(/ of \d+/, "")} &mdash; ${typeLabel}</p>
<p style="margin:0;${F}font-size:11px;color:#555555;line-height:1.6;">${tg.coverage}. ${tg.isRoundtrip ? "One PNR, one carrier. Carrier rebooking protection end to end." : "Separate PNR. Independent fare rules."}</p>
</td>`;
  }

  return `<tr><td style="padding:0 48px 32px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border:1px solid #e0dbd4;">
<tr><td style="padding:20px 22px;">

<p style="margin:0 0 16px 0;${F}font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">How This Trip Is Ticketed</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${mapCells}</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-top:1px solid #e8e4de;padding-top:14px;">
<tr>${legendCells}</tr>
</table>

</td></tr></table></td></tr>`;
}

// ── Multi-Strategy: Identity Bar for Ticket Options ──────────────────────────

function htmlMsIdentityBar(opt: MsTicketOption, label: string, eyebrow: string, rightTopLine: string, rightBottomLine: string): string {
  const carrier = opt.carriers.map((c) => carrierFullName(c)).join(" + ");
  const flightNums = opt.flights.map((f) => f.flight).join(" &middot; ");

  return `<tr><td style="padding:8px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2c2c2c;">
<tr><td style="padding:14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<p style="margin:0 0 2px 0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${eyebrow}</p>
<p style="margin:0;${F}font-size:17px;font-weight:bold;color:#ffffff;">${carrier} &nbsp;<span style="font-weight:normal;font-size:14px;color:#a8a8a8;">${flightNums}</span></p>
</td>
<td style="text-align:right;">
<p style="margin:0 0 2px 0;${F}font-size:12px;color:#a8a8a8;">${rightTopLine}</p>
<p style="margin:0;${F}font-size:11px;font-weight:bold;color:#8b7355;">${rightBottomLine}</p>
</td>
</tr>
</table></td></tr></table></td></tr>`;
}

// ── Multi-Strategy: Routing Zone (supports direction separators, stay gaps) ──

function htmlMsRoutingZone(flights: Scenario["tickets"][0]["flights"], directionSeparators?: { afterFlightIdx: number; label: string }[]): string {
  const sepMap = new Map<number, string>();
  (directionSeparators || []).forEach((s) => sepMap.set(s.afterFlightIdx, s.label));

  let html = `<tr><td style="padding:0 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-bottom:0;background-color:#fafaf8;">
<tr><td style="padding:18px 22px 4px 22px;">`;

  flights.forEach((f, fi) => {
    const departAirport = f.route.split(" \u2192 ")[0]?.trim() || "";
    const arriveAirport = f.route.split(" \u2192 ")[1]?.trim() || "";
    const acName = aircraftName(f.aircraft);
    const plusDay = dayDiff(f.departISO, f.arriveISO);
    const cabinLabel = f.cabin ? cabinDisplayName(f.cabin) : "";

    // Check if there's a direction label before this flight (from separators)
    // First flight gets a direction label if one is set for index -1
    if (fi === 0 && sepMap.has(-1)) {
      html += `<p style="margin:0 0 12px 0;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${sepMap.get(-1)}</p>`;
    }

    // Segment block: 3 columns — timeline dots | details | duration
    html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="width:20px;vertical-align:top;padding-top:3px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:20px;">
<tr><td align="center"><div style="width:9px;height:9px;border-radius:50%;background-color:#8b7355;margin:0 auto;">&nbsp;</div></td></tr>
<tr><td align="center"><div style="width:1px;height:36px;background-color:#c8bfb4;margin:2px auto;">&nbsp;</div></td></tr>
<tr><td align="center"><div style="width:9px;height:9px;border-radius:50%;background-color:#8b7355;margin:0 auto;">&nbsp;</div></td></tr>
</table>
</td>
<td style="padding-left:14px;vertical-align:top;">
<p style="margin:0 0 1px 0;${F}font-size:15px;font-weight:bold;color:#2c2c2c;">${timeFmt12(f.departISO)} &nbsp;&middot;&nbsp; ${airportDisplay(departAirport)}</p>
<p style="margin:0 0 24px 0;${F}font-size:11px;color:#888888;">${f.flight}${acName ? ` &nbsp;&middot;&nbsp; ${acName}` : ""}${cabinLabel ? ` &nbsp;&middot;&nbsp; ${cabinLabel}` : ""}</p>
<p style="margin:0;${F}font-size:15px;font-weight:bold;color:#2c2c2c;">${timeFmt12(f.arriveISO)}${plusDay ? `<span style="font-size:10px;color:#b45309;font-weight:bold;">${plusDay}</span>` : ""} &nbsp;&middot;&nbsp; ${airportDisplay(arriveAirport)}</p>
</td>
<td style="text-align:right;vertical-align:middle;padding-bottom:6px;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:#2c2c2c;">${f.duration}</p>
<p style="margin:0;${F}font-size:11px;color:#888888;">Nonstop</p>
</td>
</tr>
</table>`;

    // Direction separator or layover after this flight
    if (fi < flights.length - 1) {
      if (sepMap.has(fi)) {
        // Direction separator (centered label with lines)
        html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;">
<tr>
<td style="border-bottom:1px solid #e0dbd4;line-height:0;">&nbsp;</td>
<td style="white-space:nowrap;padding:0 12px;${F}font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${sepMap.get(fi)}</td>
<td style="border-bottom:1px solid #e0dbd4;line-height:0;">&nbsp;</td>
</tr>
</table>`;
      } else {
        // Regular layover bar
        const nextFlight = flights[fi + 1];
        const layoverMs = new Date(nextFlight.departISO).getTime() - new Date(f.arriveISO).getTime();
        const layoverMins = Math.floor(layoverMs / (1000 * 60));
        const layoverHrs = Math.floor(layoverMins / 60);
        const layoverRemMins = layoverMins % 60;
        const layoverText = layoverHrs > 0 ? `${layoverHrs}h ${layoverRemMins}m` : `${layoverMins} min`;
        const layoverCity = airportDisplay(arriveAirport);

        html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 10px 34px;border-top:1px dashed #d0c9be;border-bottom:1px dashed #d0c9be;">
<tr><td style="padding:8px 0;">
<p style="margin:0;${F}font-size:12px;color:#555555;"><strong style="color:#2c2c2c;">${layoverText} layover</strong> &nbsp;&middot;&nbsp; ${layoverCity}</p>
</td></tr></table>`;
      }
    }
  });

  html += `</td></tr></table></td></tr>`;
  return html;
}

// ── Multi-Strategy: Package-Row Fare Table (4-column, for roundtrip tickets) ──

function htmlMsPackageFareTable(opt: MsTicketOption, priceLabel: string = "per person, roundtrip"): string {
  if (opt.fares.length === 0) return "";

  // Group fares into packages: same cabin combo → non-ref and ref pair
  interface FarePackage {
    packageName: string;
    subtitle: string;
    includes: string[];
    fares: typeof opt.fares;
  }

  // Group by cabin+brand pattern (non-ref and ref variants grouped together)
  const pkgMap = new Map<string, FarePackage>();
  for (const fare of opt.fares) {
    const cabinKey = fare.cabinClass + "_" + (fare.brandName || "").replace(/\s*(flex|refundable)\s*/gi, "").trim();
    if (!pkgMap.has(cabinKey)) {
      const cabDisplay = cabinDisplayName(fare.cabinClass);
      const includes: string[] = [];
      if (fare.fareTerms?.seatType) includes.push(fare.fareTerms.seatType);
      if (fare.fareTerms?.baggage) includes.push(fare.fareTerms.baggage);

      pkgMap.set(cabinKey, {
        packageName: cabDisplay,
        subtitle: fare.brandName || cabDisplay,
        includes,
        fares: [],
      });
    }
    pkgMap.get(cabinKey)!.fares.push(fare);
  }

  // Sort packages: cheapest first
  const packages = Array.from(pkgMap.values());
  packages.sort((a, b) => Math.min(...a.fares.map((f) => f.price)) - Math.min(...b.fares.map((f) => f.price)));

  // Build rows: each fare is a row; non-ref before ref within package
  let rows = "";
  for (const pkg of packages) {
    pkg.fares.sort((a, b) => (a.refundable ? 1 : 0) - (b.refundable ? 1 : 0));

    for (const fare of pkg.fares) {
      const isRef = fare.refundable;
      const rowBg = isRef ? "#f7fdf7" : "#ffffff";
      const nameColor = isRef ? "#2e7d32" : "#2c2c2c";
      const priceColor = isRef ? "#2e7d32" : "#2c2c2c";

      const packageLabel = isRef ? `${pkg.packageName} &middot; Flex` : pkg.packageName;
      const subtitle = isRef ? "Fully refundable" : "Non-refundable";

      const includeLines = pkg.includes.map((inc) =>
        `<p style="margin:0 0 2px 0;${F}font-size:11px;color:#555555;">${inc}</p>`
      ).join("");

      let changeText = "&mdash;";
      if (fare.fareTerms) {
        if (fare.fareTerms.changePolicy === "free") changeText = "Free";
        else if (fare.fareTerms.changePolicy === "fee") changeText = fare.fareTerms.changeSummary || "Fee applies";
        else if (fare.fareTerms.changePolicy === "none") changeText = "Not permitted";
        else if (fare.fareTerms.changeSummary && fare.fareTerms.changeSummary !== "No Changes") changeText = fare.fareTerms.changeSummary;
      }

      rows += `<tr style="background-color:${rowBg};">
<td style="padding:13px 16px;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;vertical-align:top;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:${nameColor};">${packageLabel}</p>
<p style="margin:0;${F}font-size:11px;color:#888888;">${subtitle}</p>
</td>
<td style="padding:13px 16px;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;vertical-align:top;">
${includeLines || `<p style="margin:0;${F}font-size:11px;color:#555555;">${cabinDisplayName(fare.cabinClass)}</p>`}
</td>
<td style="padding:13px 16px;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;vertical-align:top;text-align:center;">
<p style="margin:0;${F}font-size:12px;color:#555555;">${changeText}</p>
</td>
<td style="padding:13px 16px;border-bottom:1px solid #e0dbd4;vertical-align:top;text-align:right;">
<p style="margin:0;${F}font-size:20px;font-weight:bold;color:${priceColor};">${fare.priceStr}</p>
</td>
</tr>`;
    }
  }

  return `<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-collapse:collapse;">
<tr style="background-color:#f5f4f1;">
<td style="padding:9px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;width:42%;">Package &nbsp;&middot;&nbsp; ${priceLabel}</td>
<td style="padding:9px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;width:30%;">Includes</td>
<td style="padding:9px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;width:13%;text-align:center;">Changes</td>
<td style="padding:9px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-bottom:1px solid #e0dbd4;text-align:right;width:15%;">Price</td>
</tr>
${rows}
</table></td></tr>`;
}

// ── Multi-Strategy: Simple Fare Table (for one-way tickets) ──────────────────

function htmlMsSimpleFareTable(opt: MsTicketOption): string {
  if (opt.fares.length === 0) return "";

  // Column header
  const cabin = cabinDisplayName(opt.fares[0]?.cabinClass || "Economy");
  const bagInfo = opt.fares[0]?.fareTerms?.baggage;
  const headerExtra = bagInfo ? ` &middot; ${bagInfo}` : "";

  let rows = "";
  for (const fare of opt.fares) {
    const isRef = fare.refundable;
    const rowBg = isRef ? "#f7fdf7" : "#ffffff";
    const nameColor = isRef ? "#2e7d32" : "#2c2c2c";
    const priceColor = isRef ? "#2e7d32" : "#2c2c2c";

    const packageLabel = isRef ? `${cabin} &middot; Flex` : `${cabin} &middot; Non-refundable`;
    const subtitle = isRef ? "Fully refundable" : fare.fareTerms?.changeSummary || "Non-refundable";

    let changeText = "&mdash;";
    if (fare.fareTerms) {
      if (fare.fareTerms.changePolicy === "free") changeText = "Free";
      else if (fare.fareTerms.changePolicy === "fee") changeText = fare.fareTerms.changeSummary || "Fee applies";
      else if (fare.fareTerms.changePolicy === "none") changeText = "Not permitted";
      else if (fare.fareTerms.changeSummary && fare.fareTerms.changeSummary !== "No Changes") changeText = fare.fareTerms.changeSummary;
    }

    rows += `<tr style="background-color:${rowBg};">
<td style="padding:13px 16px;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;vertical-align:top;width:55%;">
<p style="margin:0 0 2px 0;${F}font-size:13px;font-weight:bold;color:${nameColor};">${packageLabel}</p>
<p style="margin:0;${F}font-size:11px;color:#888888;">${subtitle}</p>
</td>
<td style="padding:13px 16px;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;vertical-align:top;text-align:center;width:20%;">
<p style="margin:0;${F}font-size:12px;color:#555555;">${changeText}</p>
</td>
<td style="padding:13px 16px;border-bottom:1px solid #e0dbd4;vertical-align:top;text-align:right;width:25%;">
<p style="margin:0;${F}font-size:20px;font-weight:bold;color:${priceColor};">${fare.priceStr}</p>
</td>
</tr>`;
  }

  return `<tr><td style="padding:0 48px 24px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-top:0;border-collapse:collapse;">
<tr style="background-color:#f5f4f1;">
<td colspan="3" style="padding:9px 16px;${F}font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888888;border-bottom:1px solid #e0dbd4;">Per person, one-way &nbsp;&middot;&nbsp; ${cabin}${headerExtra}</td>
</tr>
${rows}
</table></td></tr>`;
}

// ── Multi-Strategy: Combined Pricing Table ───────────────────────────────────

function htmlMsCombinedPricingTable(scenarios: Scenario[], ticketGroups: MsTicketGroup[]): string {
  if (scenarios.length === 0 || ticketGroups.length < 2) return "";

  // Build combination rows from scenarios (which are already Cartesian products)
  const hasRef = scenarios.some((s) => s.allFlex);
  const hasNonRef = scenarios.some((s) => !s.allFlex);
  const showBothCols = hasRef && hasNonRef;

  // Dedupe and pick the most relevant combinations (up to 6)
  interface ComboRow {
    ticket1Desc: string;
    ticket2Desc: string;
    nonRefTotal: string | null;
    flexTotal: string | null;
    nonRefRaw: number | null;
    flexRaw: number | null;
  }

  // Group scenarios by their ticket descriptions
  const comboMap = new Map<string, ComboRow>();
  for (const sc of scenarios) {
    const t1 = sc.tickets[0];
    const t2 = sc.tickets[1];
    if (!t1 || !t2) continue;

    const t1Desc = `${cabinDisplayName(t1.cabinClass)} (${carrierFullName(t1.carrier).split(" ")[0]})`;
    const t2Flights = t2.flights.map((f) => f.flight).join("+");
    const t2Desc = `Option ${t2Flights}`;
    const comboKey = `${t1.cabinClass}_${t1.refundable}_${t2Flights}_${t2.refundable}`;

    if (!comboMap.has(comboKey)) {
      comboMap.set(comboKey, {
        ticket1Desc: `${t1Desc}${t1.refundable ? " Flex" : ""}`,
        ticket2Desc: t2Desc,
        nonRefTotal: !sc.allFlex ? sc.totalPrice : null,
        flexTotal: sc.allFlex ? sc.totalPrice : null,
        nonRefRaw: !sc.allFlex ? sc.totalRaw : null,
        flexRaw: sc.allFlex ? sc.totalRaw : null,
      });
    } else {
      const existing = comboMap.get(comboKey)!;
      if (sc.allFlex && !existing.flexTotal) {
        existing.flexTotal = sc.totalPrice;
        existing.flexRaw = sc.totalRaw;
      }
      if (!sc.allFlex && !existing.nonRefTotal) {
        existing.nonRefTotal = sc.totalPrice;
        existing.nonRefRaw = sc.totalRaw;
      }
    }
  }

  // Flatten and sort
  let combos = Array.from(comboMap.values());
  combos.sort((a, b) => (a.nonRefRaw || a.flexRaw || 0) - (b.nonRefRaw || b.flexRaw || 0));
  if (combos.length > 6) combos = combos.slice(0, 6);

  let rows = "";
  combos.forEach((combo, ci) => {
    const bg = ci % 2 === 0 ? "#ffffff" : "#fafaf8";
    rows += `<tr style="background-color:${bg};">
<td style="padding:11px 14px;${F}font-size:12px;color:#2c2c2c;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;">${combo.ticket1Desc}</td>
<td style="padding:11px 14px;${F}font-size:12px;color:#2c2c2c;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;">+ ${combo.ticket2Desc}</td>`;

    if (showBothCols) {
      rows += `<td style="padding:11px 14px;${F}font-size:13px;font-weight:bold;color:#2c2c2c;text-align:right;border-right:1px solid #e0dbd4;border-bottom:1px solid #e0dbd4;">${combo.nonRefTotal || "&mdash;"}</td>
<td style="padding:11px 14px;${F}font-size:13px;font-weight:bold;color:#2e7d32;text-align:right;border-bottom:1px solid #e0dbd4;">${combo.flexTotal || "&mdash;"}</td>`;
    } else {
      const price = combo.nonRefTotal || combo.flexTotal;
      const isGreen = !combo.nonRefTotal && combo.flexTotal;
      rows += `<td style="padding:11px 14px;${F}font-size:13px;font-weight:bold;color:${isGreen ? "#2e7d32" : "#2c2c2c"};text-align:right;border-bottom:1px solid #e0dbd4;">${price || "&mdash;"}</td>`;
    }

    rows += `</tr>`;
  });

  // Footer note
  rows += `<tr style="background-color:#fef9f4;">
<td colspan="${showBothCols ? 4 : 3}" style="padding:10px 14px;">
<p style="margin:0;${F}font-size:11px;color:#8b7355;font-style:italic;">All combinations available. Totals are per person. Reply with your choices and I&rsquo;ll confirm the combined price.</p>
</td></tr>`;

  const t1Label = ticketGroups[0]?.ticketLabel.replace(/ of \d+/, "") || "Ticket 1";
  const t2Label = ticketGroups[1]?.ticketLabel.replace(/ of \d+/, "") || "Ticket 2";

  return `<tr><td style="padding:0 48px 0 48px;border-top:2px solid #eeebe5;">
<p style="margin:24px 0 14px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Combined Pricing</p>
</td></tr>
<tr><td style="padding:0 48px 28px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0dbd4;border-collapse:collapse;">
<tr style="background-color:#2c2c2c;">
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#e8e4de;border-right:1px solid #3a3a3a;">${t1Label} package</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#e8e4de;border-right:1px solid #3a3a3a;">+ ${t2Label} option</td>
${showBothCols
  ? `<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#a8a8a8;text-align:right;border-right:1px solid #3a3a3a;">Non-ref total</td>
<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#2e7d32;text-align:right;">Flex total</td>`
  : `<td style="padding:9px 14px;${F}font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#e8e4de;text-align:right;">Per person</td>`}
</tr>
${rows}
</table></td></tr>`;
}

// ── Multi-Strategy: How to Reply Block ───────────────────────────────────────

function htmlMsHowToReply(ticketGroups: MsTicketGroup[]): string {
  const numTickets = ticketGroups.length;

  let replyText: string;
  if (numTickets === 2) {
    replyText = `Two choices to make &mdash; one for each ticket. Reply with your ${ticketGroups[0].ticketLabel.replace(/ of \d+/, "")} package and ${ticketGroups[1].ticketLabel.replace(/ of \d+/, "")} option, for example: <strong>&ldquo;${ticketGroups[0].ticketLabel.replace(/ of \d+/, "")}: Option A, non-refundable &mdash; ${ticketGroups[1].ticketLabel.replace(/ of \d+/, "")}: Option 1, non-refundable.&rdquo;</strong>`;
  } else {
    replyText = `Reply with your preferred option for each ticket &mdash; for example, <strong>&ldquo;Ticket 1: Option A &mdash; Ticket 2: Option 1.&rdquo;</strong>`;
  }

  return `<tr><td style="padding:0 48px 28px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;border-left:3px solid #e0dbd4;">
<tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px 0;${F}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">How to Reply</p>
<p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.85;">${replyText}</p>
</td></tr></table></td></tr>`;
}

// ── Multi-Strategy: Multi-Ticket Disclaimer ──────────────────────────────────

function htmlMsMultiTicketDisclaimer(ticketGroups: MsTicketGroup[]): string {
  const numTickets = ticketGroups.length;
  const ticketNums = ticketGroups.map((_, i) => i + 1).join(" and ");
  return `<tr><td style="padding:0 48px 16px 48px;">
<p style="margin:0;${F}font-size:12px;color:#555555;font-style:italic;line-height:1.7;">Tickets ${ticketNums} are booked separately and have independent fare rules and cancellation policies. Each must be ticketed to its own deadline.</p></td></tr>`;
}

// ── Multi-Strategy Renderers ─────────────────────────────────────────────────

function renderMultiStrategyFixed(scenarios: Scenario[], model: StrategyModel, copy: ProposalCopy): string {
  const sc = scenarios[0];
  if (!sc) return wrapEmailShell(model, htmlHeader(model) + htmlFooter());

  const ticketGroups = extractMsTicketGroups(scenarios);
  const bodyNote = ticketGroups.length > 1
    ? `This trip uses ${ticketGroups.length} separate bookings to get you the best routing and fares. Details below.`
    : "";

  let sections = "";

  // Trip architecture block for multi-ticket
  if (ticketGroups.length > 1) {
    sections += htmlTripArchitectureBlock(ticketGroups, model);
  }

  // Render each ticket
  for (const tg of ticketGroups) {
    const opt = tg.options[0];
    if (!opt) continue;

    // Ticket section header
    if (ticketGroups.length > 1) {
      const typeLabel = tg.isRoundtrip ? "Open-jaw Roundtrip" : "One-way";
      sections += `<tr><td style="padding:${tg.ticketIdx > 0 ? "4px 48px 8px 48px;border-top:2px solid #2c2c2c;" : "0 48px 8px 48px;"}">
<p style="margin:${tg.ticketIdx > 0 ? "20" : "0"}px 0 3px 0;${F}font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${tg.ticketLabel} &mdash; ${typeLabel}</p>
<p style="margin:0;${F}font-size:20px;font-weight:bold;color:#2c2c2c;">${tg.coverage}</p>
</td></tr>`;
    }

    // Identity bar
    const carrier = opt.carriers.map((c) => carrierFullName(c)).join(" + ");
    const stopsText = opt.flights.length === 1 ? "Nonstop" : `${opt.flights.length - 1} stop${opt.flights.length > 2 ? "s" : ""}`;

    sections += htmlMsIdentityBar(
      opt,
      carrier,
      `${stopsText} &middot; ${carrierFullName(opt.carrier)}`,
      tg.coverage,
      tg.isRoundtrip ? "Open-jaw roundtrip" : "One-way"
    );

    // Routing zone with direction separators for roundtrip
    const seps: { afterFlightIdx: number; label: string }[] = [];
    if (tg.isRoundtrip && opt.flights.length >= 2) {
      // Find the return direction separator — roughly halfway through the flights
      const midIdx = Math.floor(opt.flights.length / 2) - 1;
      if (midIdx >= 0) {
        const returnFlight = opt.flights[midIdx + 1];
        const returnDate = fullDateFmt(returnFlight.departISO);
        seps.push({ afterFlightIdx: midIdx, label: `Return &middot; ${returnDate}` });
      }
      // Outbound label
      seps.push({ afterFlightIdx: -1, label: `Outbound &middot; ${fullDateFmt(opt.flights[0].departISO)}` });
    }

    sections += htmlMsRoutingZone(opt.flights, seps);

    // Fare table
    if (tg.isRoundtrip) {
      sections += htmlMsPackageFareTable(opt, "per person, roundtrip");
    } else {
      sections += htmlMsSimpleFareTable(opt);
    }
  }

  // Multi-ticket disclaimer and pricing
  if (ticketGroups.length > 1) {
    sections += htmlMsMultiTicketDisclaimer(ticketGroups);
  }
  sections += htmlPricingSummary(sc);

  return wrapEmailShell(model, [
    htmlHeader(model),
    htmlEmailBody(copy.introduction, bodyNote),
    htmlDiamond(),
    htmlTripDetailsBar(model),
    sections,
    htmlWatchOuts(copy.watchOuts || []),
    htmlRecommendation(copy.recommendation || ""),
    htmlAdvisorNotes(copy.advisorNotes || ""),
    htmlBookingTerms(),
    htmlFooter(),
  ].join(""));
}

function renderMultiStrategyFlex(scenarios: Scenario[], model: StrategyModel, copy: ProposalCopy): string {
  const ticketGroups = extractMsTicketGroups(scenarios);

  const bodyNote = ticketGroups.length > 1
    ? "The sections below are independent choices &mdash; pick one option for each ticket. I&rsquo;ve shown the combined cost at the bottom."
    : "";

  let sections = "";

  // Trip architecture block
  if (ticketGroups.length > 1) {
    sections += htmlTripArchitectureBlock(ticketGroups, model);
  }

  // Render each ticket section
  for (const tg of ticketGroups) {
    // Section header
    const typeLabel = tg.isRoundtrip ? "Open-jaw Roundtrip" : "Internal One-way";
    const chooseText = tg.options.length > 1 ? " &middot; Choose one" : "";

    if (ticketGroups.length > 1) {
      sections += `<tr><td style="padding:${tg.ticketIdx > 0 ? "4px 48px 8px 48px;border-top:2px solid #2c2c2c;" : "0 48px 8px 48px;"}">
<p style="margin:${tg.ticketIdx > 0 ? "20" : "0"}px 0 3px 0;${F}font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">${tg.ticketLabel} &mdash; ${typeLabel}${chooseText}</p>
<p style="margin:0;${F}font-size:20px;font-weight:bold;color:#2c2c2c;">${tg.coverage}</p>
</td></tr>`;
    }

    // Label options: Ticket 1 uses A, B, C; Ticket 2 uses Option 1, 2, 3
    const isFirstTicket = tg.ticketIdx === 0;

    tg.options.forEach((opt, oi) => {
      const optLabel = isFirstTicket
        ? `Option ${String.fromCharCode(65 + oi)}`
        : `Option ${oi + 1}`;

      // Build eyebrow text
      const numStops = opt.flights.length - 1;
      const stopsText = numStops === 0 ? "Nonstop" : `${numStops} stop${numStops > 1 ? "s" : ""}`;
      const eyebrow = tg.isRoundtrip
        ? `${optLabel} &nbsp;&middot;&nbsp; ${stopsText} both ways`
        : `${optLabel} &nbsp;&middot;&nbsp; ${stopsText}`;

      // Build right side info
      const firstFlight = opt.flights[0];
      const lastFlight = opt.flights[opt.flights.length - 1];
      const routeEndpoints = `${firstFlight.route.split(" \u2192 ")[0]?.trim()} &rarr; ${lastFlight.route.split(" \u2192 ")[1]?.trim()}`;

      sections += htmlMsIdentityBar(
        opt,
        optLabel,
        eyebrow,
        routeEndpoints,
        tg.isRoundtrip ? "Open-jaw roundtrip" : `${opt.flights.length} separate legs`
      );

      // Routing zone
      const seps: { afterFlightIdx: number; label: string }[] = [];
      if (tg.isRoundtrip && opt.flights.length >= 2) {
        const midIdx = Math.floor(opt.flights.length / 2) - 1;
        if (midIdx >= 0) {
          const returnFlight = opt.flights[midIdx + 1];
          seps.push({ afterFlightIdx: midIdx, label: `Return &middot; ${fullDateFmt(returnFlight.departISO)}` });
        }
        seps.push({ afterFlightIdx: -1, label: `Outbound &middot; ${fullDateFmt(opt.flights[0].departISO)}` });
      } else if (!tg.isRoundtrip && opt.flights.length >= 2) {
        // Internal one-way with multiple legs — add leg labels
        opt.flights.forEach((f, fi) => {
          if (fi === 0) {
            seps.push({ afterFlightIdx: -1, label: `Leg 1 &middot; ${fullDateFmt(f.departISO)}` });
          }
        });
        // Check for multi-day gaps between flights (stay separators)
        for (let fi = 0; fi < opt.flights.length - 1; fi++) {
          const arrDate = new Date(opt.flights[fi].arriveISO);
          const depDate = new Date(opt.flights[fi + 1].departISO);
          const dayGap = Math.floor((depDate.getTime() - arrDate.getTime()) / (1000 * 60 * 60 * 24));
          if (dayGap >= 1) {
            // Stay separator
            const arrAirport = opt.flights[fi].route.split(" \u2192 ")[1]?.trim() || "";
            const cityName = AIRPORT_FULL_NAMES[arrAirport]?.city || arrAirport;
            seps.push({
              afterFlightIdx: fi,
              label: `${dayGap} night${dayGap > 1 ? "s" : ""} &middot; ${cityName}`
            });
          }
        }
      }

      sections += htmlMsRoutingZone(opt.flights, seps);

      // Fare table
      if (tg.isRoundtrip) {
        sections += htmlMsPackageFareTable(opt, "per person, roundtrip");
      } else {
        sections += htmlMsSimpleFareTable(opt);
      }
    });
  }

  // Combined pricing table
  if (ticketGroups.length > 1) {
    sections += htmlMsCombinedPricingTable(scenarios, ticketGroups);
  }

  // How to reply
  if (ticketGroups.length > 1) {
    sections += htmlMsHowToReply(ticketGroups);
  }

  // Multi-ticket disclaimer
  if (ticketGroups.length > 1) {
    sections += htmlMsMultiTicketDisclaimer(ticketGroups);
  }

  return wrapEmailShell(model, [
    htmlHeader(model),
    htmlEmailBody(copy.introduction, bodyNote),
    htmlDiamond(),
    htmlTripDetailsBar(model),
    sections,
    htmlWatchOuts(copy.watchOuts || []),
    htmlRecommendation(copy.recommendation || ""),
    htmlAdvisorNotes(copy.advisorNotes || ""),
    htmlBookingTerms(),
    htmlFooter(),
  ].join(""));
}

// ── Main Proposal Builder (dispatch) ─────────────────────────────────────────

interface ProposalCopy {
  introduction?: string;
  recommendation?: string;
  advisorNotes?: string;
  watchOuts?: string[];
}

function buildProposalHTML(
  scenarios: Scenario[],
  model: StrategyModel,
  copy: ProposalCopy = {},
  classification?: ProposalClassification | null
): string {
  if (!scenarios.length) return "";

  // Infer classification from scenarios if not provided
  const pType = classification?.type || inferTypeFromScenarios(scenarios);

  switch (pType) {
    case "ROUNDTRIP":
      return renderRoundtrip(scenarios, model, copy);
    case "ONE_WAY":
      return renderOneWay(scenarios, model, copy, classification?.fixed ?? scenarios.length === 1);
    case "MULTI_STRATEGY_FIXED":
      return renderMultiStrategyFixed(scenarios, model, copy);
    case "MULTI_STRATEGY_FLEX":
      return renderMultiStrategyFlex(scenarios, model, copy);
    default:
      return renderRoundtrip(scenarios, model, copy);
  }
}

function inferTypeFromScenarios(scenarios: Scenario[]): ProposalType {
  // Heuristic: if all scenarios have 1 ticket → roundtrip; multiple tickets → multi-strategy
  const hasMultiTicket = scenarios.some((s) => s.tickets.length > 1);
  if (!hasMultiTicket) return "ROUNDTRIP";
  if (scenarios.length === 1) return "MULTI_STRATEGY_FIXED";
  return "MULTI_STRATEGY_FLEX";
}

function patchCopyIntoHTML(
  html: string,
  copy: { introduction?: string; recommendation?: string; advisorNotes?: string; watchOuts?: string[]; scenarios?: { id: string; rationale: string }[] }
): string {
  let out = html;

  // Patch introduction
  if (copy.introduction) {
    out = out.replace(
      /<!--PLACEHOLDER:INTRO-->Loading advisor notes&hellip;/,
      copy.introduction
    );
    // Also fix the style from italic/muted to normal
    out = out.replace(
      "color:#999999;font-style:italic;line-height:1.8;\">",
      "color:#555555;line-height:1.8;\">"
    );
  }

  // Patch scenario rationales
  (copy.scenarios || []).forEach(({ id, rationale }) => {
    out = out.replace(
      `<!--PLACEHOLDER:RATIONALE_${id}-->Loading advisor notes&hellip;`,
      rationale
    );
    // Fix style for this rationale
    out = out.replace(
      `color:#999999;line-height:1.7;font-style:italic;">${rationale}`,
      `color:#555555;line-height:1.7;font-style:italic;">${rationale}`
    );
  });

  // Patch recommendation
  if (copy.recommendation) {
    out = out.replace(
      /<!--PLACEHOLDER:RECOMMENDATION-->Loading recommendation&hellip;/,
      copy.recommendation
    );
    out = out.replace(
      "color:#999999;font-style:italic;line-height:1.85;\">",
      "color:#555555;line-height:1.85;\">"
    );
  }

  // Patch watch-outs (inject before recommendation if not already present)
  if ((copy.watchOuts || []).length && !out.includes("Important Considerations")) {
    const warnHTML = `<tr><td style="padding:0 48px 20px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff9f0;border:1px solid #e8dcc8;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b45309;font-weight:bold;">&#9888; Important Considerations</p>
${copy.watchOuts!.map(w => `<p style="margin:0 0 4px 0;${F}font-size:12px;color:#555555;line-height:1.7;padding-left:12px;border-left:2px solid #e8dcc8;">${w}</p>`).join("")}
</td></tr></table></td></tr>`;
    out = out.replace("Recommendation</p></td></tr>", `Recommendation</p></td></tr>\n${warnHTML}`);
  }

  // Patch advisor notes
  if (copy.advisorNotes && !out.includes("Advisor Notes")) {
    out = out.replace(
      "Booking Terms</p></td></tr>",
      `Advisor Notes</p></td></tr>
<tr><td style="padding:0 48px 20px 48px;">
<p style="margin:0;${F}font-size:13px;color:#555555;line-height:1.85;">${copy.advisorNotes}</p></td></tr>
<tr><td style="padding:8px 48px 6px 48px;">
<p style="margin:0 0 8px 0;${F}font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8b7355;font-weight:bold;">Booking Terms</p></td></tr>`
    );
  }

  return out;
}

// ── Proposal Viewer ───────────────────────────────────────────────────────────

function ProposalViewer({ html, onBack }: { html: string; onBack: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const download = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flight-comparison-proposal.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#080b14] flex flex-col z-[1000]">
      <div className="shrink-0 flex items-center justify-between px-[14px] py-2 bg-[#080b14]/[0.98] border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="bg-white/5 border border-white/10 text-slate-400 px-3 py-[5px] rounded-[5px] cursor-pointer text-[11px] font-semibold"
          >
            ← Back
          </button>
          <span className="text-[10px] text-slate-600 tracking-wider">PROPOSAL PREVIEW</span>
        </div>
        <div className="flex gap-[6px]">
          <button
            onClick={print}
            className="bg-white/5 border border-white/[0.12] text-slate-400 px-[13px] py-[5px] rounded-[5px] cursor-pointer text-[11px] font-semibold"
          >
            ⎙ Print
          </button>
          <button
            onClick={download}
            className="bg-indigo-600 border-none text-white px-4 py-[5px] rounded-[5px] cursor-pointer text-[11px] font-bold tracking-wide"
          >
            ↓ Download .html
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        className="flex-1 border-none w-full bg-white"
        title="Proposal Preview"
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ComparisonBuilderProps {
  response: SearchResponse;
  searchSegments: SegmentInput[];
  passengers: PassengerConfig;
  onBack: () => void;
  onNewSearch?: () => void;
  apiKey?: string;
}

export default function ComparisonBuilder({
  response,
  searchSegments,
  passengers,
  onBack,
  onNewSearch,
  apiKey,
}: ComparisonBuilderProps) {
  // Transform Sabre data into strategy model
  const model = useMemo(
    () => transformToStrategyModel(response, searchSegments, passengers),
    [response, searchSegments, passengers]
  );

  const systemPrompt = useMemo(() => buildSystemPrompt(model), [model]);

  // UI state
  const [tab, setTab] = useState(0);
  const [activeSlots, setActiveSlots] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    model.strategies.forEach((s) => {
      if (s.slots.length > 0) init[s.id] = s.slots[0].id;
    });
    return init;
  });

  // Selection state: sels[strategyId][slotId] = Set of "optionId:variantIndex"
  const [sels, setSels] = useState<SelectionState>(() => {
    const init: SelectionState = {};
    model.strategies.forEach((s) => {
      init[s.id] = {};
      s.slots.forEach((sl) => {
        init[s.id][sl.id] = new Set();
      });
    });
    return init;
  });

  // AI suggested options per slot
  const [aiSuggested, setAiSuggested] = useState<Record<string, Record<string, AIOption[]>>>({});

  // Chat
  const buildWelcome = useCallback(() => {
    const stratSummaries = model.strategies
      .map((s) => {
        const cheapest = s.slots.reduce((sum, sl) => {
          const cheapOpt = sl.options[0]?.variants[0]?.perAdult;
          return sum + (cheapOpt || 0);
        }, 0);
        return `◆ Strategy ${s.num} — ${s.label}: from ${pfmt(cheapest)}`;
      })
      .join("\n");
    return `Hello! I'm your flight strategy assistant for ${model.routeSummary} (${model.dateSummary}).

Browse fares in the strategy tabs on the left, or just ask me — I'll suggest options as interactive cards you can check off right here in the chat.

Once you've got what you want checked, hit Build Proposal and I'll generate a formatted HTML document ready to email.

${stratSummaries}

What are your client's priorities?`;
  }, [model]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: buildWelcome() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposalHTML, setProposalHTML] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const strategy = model.strategies[tab];
  if (!strategy) return null;

  const activeSlot = activeSlots[strategy.id] || strategy.slots[0]?.id;
  const activeSlotDef = strategy.slots.find((s) => s.id === activeSlot);

  // ── Selection helpers ──

  const makeKey = (optId: string, vi: number) => `${optId}:${vi}`;

  const resolveSlotItems = useCallback(
    (stratId: string, slotId: string): ComboItem[] => {
      const keys = sels[stratId]?.[slotId] || new Set<string>();
      const strat = model.strategies.find((s) => s.id === stratId);
      const slot = strat?.slots.find((sl) => sl.id === slotId);
      if (!slot) return [];

      const results: ComboItem[] = [];
      keys.forEach((key) => {
        const [optId, viStr] = key.split(":");
        const vi = parseInt(viStr);
        const opt = slot.options.find((o) => o.id === optId);
        if (opt && opt.variants[vi]) {
          results.push({ option: opt, variant: opt.variants[vi], variantIdx: vi });
        }
      });
      return results.sort((a, b) => a.variant.perAdult - b.variant.perAdult);
    },
    [sels, model.strategies]
  );

  const toggleFare = (optionId: string, variantIdx: number) => {
    const key = makeKey(optionId, variantIdx);
    setSels((prev) => {
      const ss = { ...(prev[strategy.id] || {}) };
      const set = new Set(ss[activeSlot] || []);
      set.has(key) ? set.delete(key) : set.add(key);
      return { ...prev, [strategy.id]: { ...ss, [activeSlot]: set } };
    });
  };

  const toggleAllFares = (opt: Option, shouldSelect: boolean) => {
    setSels((prev) => {
      const ss = { ...(prev[strategy.id] || {}) };
      const set = new Set(ss[activeSlot] || []);
      opt.variants.forEach((_, vi) => {
        const key = makeKey(opt.id, vi);
        shouldSelect ? set.add(key) : set.delete(key);
      });
      return { ...prev, [strategy.id]: { ...ss, [activeSlot]: set } };
    });
  };

  // Unified toggle for chat suggestion cards
  const toggleSuggestionFare = (stratId: string, slotId: string, optId: string, vi: number) => {
    const key = makeKey(optId, vi);
    setSels((prev) => {
      const ss = { ...(prev[stratId] || {}) };
      const set = new Set(ss[slotId] || []);
      set.has(key) ? set.delete(key) : set.add(key);
      return { ...prev, [stratId]: { ...ss, [slotId]: set } };
    });
  };

  const getSelectedVariantIndices = (optionId: string): Set<number> => {
    const keys = sels[strategy.id]?.[activeSlot] || new Set<string>();
    const result = new Set<number>();
    keys.forEach((key) => {
      const [id, vi] = key.split(":");
      if (id === optionId) result.add(parseInt(vi));
    });
    return result;
  };

  const getSlotCounts = (stratId: string, slotId: string) => {
    const keys = sels[stratId]?.[slotId] || new Set<string>();
    const optIds = new Set<string>();
    keys.forEach((k) => optIds.add(k.split(":")[0]));
    return { flights: optIds.size, fares: keys.size };
  };

  const totalFares = model.strategies.reduce(
    (sum, s) =>
      sum + s.slots.reduce((ss, sl) => ss + (sels[s.id]?.[sl.id]?.size || 0), 0),
    0
  );

  // Check if an option is AI-suggested
  const isAISuggestedOpt = (stratId: string, slotId: string, optId: string) =>
    (aiSuggested[stratId]?.[slotId] || []).some((o) => o.id === optId);

  // Get all options for active slot (base + AI suggested converted to Option format)
  const activeSlotOptions = useMemo(() => {
    const base = activeSlotDef?.options || [];
    // AI suggestions are shown as separate cards in the slot, we need to merge them
    const aiOpts = aiSuggested[strategy.id]?.[activeSlot] || [];
    // Convert AI options to Option-like format for display in the side panel
    const converted: Option[] = aiOpts.map((ao) => ({
      id: ao.id,
      carrier: ao.carrier,
      carrierName: ao.carrierName || ao.carrier,
      flightKey: `ai_${ao.id}`,
      segments: ao.segments.map((s) => ({
        origin: s.origin,
        destination: s.destination,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        durationMinutes: 0,
        durationFormatted: s.durationFormatted,
        marketingCarrier: s.marketingCarrier,
        operatingCarrier: s.marketingCarrier,
        flightNumber: s.flightNumber,
        equipment: s.equipment || "",
        bookingClass: "",
        cabin: "Economy" as const,
        fareBasisCode: "",
        legs: [],
        stops: s.stops,
      })),
      totalDuration: ao.totalDuration || "",
      totalDurationMinutes: 0,
      stops: ao.segments.reduce((sum, seg) => sum + seg.stops, 0),
      score: ao.score || 0,
      variants: ao.variants.map((v) => ({
        itinerary: null as unknown as EnrichedItinerary,
        label: v.label,
        perAdult: v.perAdult,
        refundable: v.refundable,
        cabin: v.cabin || "Economy",
        cabins: [v.cabin || "Economy"],
        bookingClass: v.bookingClass || "",
        brandName: v.label,
        validatingCarrier: ao.carrier,
        fareTerms: {
          changePolicy: "none" as const,
          changeSummary: "Unknown",
          refundPolicy: v.refundable ? "full" as const : "none" as const,
          refundSummary: v.refundable ? "Refundable" : "Non-refundable",
          baggage: "",
          seatType: "",
          seatsAvailable: 0,
          highlights: [],
        },
      })),
    }));
    return [...base, ...converted];
  }, [activeSlotDef, aiSuggested, strategy.id, activeSlot]);

  // ── Filter & Sort State ──
  type SortMode = "best" | "cheapest" | "fastest";
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [filterStops, setFilterStops] = useState<"any" | "0" | "1">("any");
  const [filterRefundable, setFilterRefundable] = useState<"any" | "yes" | "no">("any");
  const [filterAirlines, setFilterAirlines] = useState<Set<string>>(new Set());

  // Available airlines in current slot
  const availableAirlines = useMemo(() => {
    const set = new Map<string, string>();
    activeSlotOptions.forEach((o) => set.set(o.carrier, o.carrierName));
    return set;
  }, [activeSlotOptions]);

  // Filtered + sorted options
  const displayOptions = useMemo(() => {
    let opts = [...activeSlotOptions];

    // Filter: stops
    if (filterStops === "0") opts = opts.filter((o) => o.stops === 0);
    else if (filterStops === "1") opts = opts.filter((o) => o.stops <= 1);

    // Filter: refundable
    if (filterRefundable === "yes") opts = opts.filter((o) => o.variants.some((v) => v.refundable));
    else if (filterRefundable === "no") opts = opts.filter((o) => o.variants.some((v) => !v.refundable));

    // Filter: airlines
    if (filterAirlines.size > 0) opts = opts.filter((o) => filterAirlines.has(o.carrier));

    // Sort
    if (sortMode === "cheapest") {
      opts.sort((a, b) => Math.min(...a.variants.map((v) => v.perAdult)) - Math.min(...b.variants.map((v) => v.perAdult)));
    } else if (sortMode === "fastest") {
      opts.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
    } else {
      // "best" — sort by score descending, then cheapest
      opts.sort((a, b) => (b.score || 0) - (a.score || 0) || Math.min(...a.variants.map((v) => v.perAdult)) - Math.min(...b.variants.map((v) => v.perAdult)));
    }

    return opts;
  }, [activeSlotOptions, sortMode, filterStops, filterRefundable, filterAirlines]);

  // Cheapest min price across all (unfiltered) options in the slot
  const slotCheapestPrice = useMemo(() => {
    if (activeSlotOptions.length === 0) return 0;
    return Math.min(...activeSlotOptions.map((o) => Math.min(...o.variants.map((v) => v.perAdult))));
  }, [activeSlotOptions]);

  // Recommended / More split
  const recommendedCount = Math.min(4, Math.ceil(displayOptions.length * 0.6));
  const hasMoreSection = displayOptions.length > recommendedCount + 1;

  // ── Chat ──

  const sendMsg = async (text: string) => {
    if (!text.trim() || loading) return;
    const um: ChatMessage = { role: "user", content: text };
    const next = [...messages, um];
    setMessages(next);
    setInput("");
    setLoading(true);

    if (!apiKey) {
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content:
            "No API key configured. The chat assistant requires an Anthropic API key to function. You can still browse and select fares in the strategy panel.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: next
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const d = await res.json();
      const txt = d.content?.find((b: { type: string }) => b.type === "text")?.text || "Error";

      try {
        const clean = txt
          .replace(/^```json\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        const parsed = JSON.parse(clean);
        if (parsed.type === "suggestions") {
          // Inject AI suggestions into state
          setAiSuggested((prev) => {
            const nxt = { ...prev };
            (parsed.slots || []).forEach(
              ({
                strategyId,
                slotId,
                options,
              }: {
                strategyId: string;
                slotId: string;
                options: AIOption[];
              }) => {
                if (!nxt[strategyId]) nxt[strategyId] = {};
                const existing = nxt[strategyId][slotId] || [];
                const existingIds = new Set(existing.map((o) => o.id));
                const newOpts = options.filter((o) => !existingIds.has(o.id));
                nxt[strategyId] = {
                  ...nxt[strategyId],
                  [slotId]: [...existing, ...newOpts],
                };
              }
            );
            return nxt;
          });

          const totalCount = (parsed.slots || []).reduce(
            (n: number, s: { options?: unknown[] }) => n + (s.options || []).length,
            0
          );
          setMessages((p) => [
            ...p,
            {
              role: "assistant",
              content:
                parsed.message ||
                `Here ${totalCount === 1 ? "is" : "are"} ${totalCount} option${totalCount > 1 ? "s" : ""} — check the fares you want to include in the proposal.`,
              suggestions: parsed.slots,
            },
          ]);
          setLoading(false);
          return;
        }
      } catch {
        // Not JSON — treat as plain text
      }
      setMessages((p) => [...p, { role: "assistant", content: txt }]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "Connection error — please retry." },
      ]);
    }
    setLoading(false);
  };

  // ── Build Proposal ──

  const buildProposal = async () => {
    const scenarios = buildScenariosFromState(sels, aiSuggested, model.strategies);
    if (!scenarios.length) return;

    const proposalClass = classifyProposal(sels, model.strategies);
    const htmlNow = buildProposalHTML(scenarios, model, {}, proposalClass);
    setProposalHTML(htmlNow);
    setMessages((p) => [
      ...p,
      {
        role: "assistant",
        content: `✅ Proposal open — ${scenarios.length} scenario${scenarios.length > 1 ? "s" : ""} built from your selections. Fetching advisor notes…`,
      },
    ]);

    if (!apiKey) return;

    const scenarioSummary = scenarios
      .map(
        (sc) =>
          `[${sc.id}] ${sc.label} — ${sc.totalPrice}${sc.allFlex ? " [all-FLEX]" : ""}`
      )
      .join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Write proposal copy for these ${scenarios.length} flight comparison scenarios:\n${scenarioSummary}\n\nReturn ONLY the proposal_copy JSON.`,
            },
          ],
        }),
      });

      const d = await res.json();
      const txt = d.content?.find((b: { type: string }) => b.type === "text")?.text || "";
      const clean = txt
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const copy = JSON.parse(clean);
      if (copy.type === "proposal_copy") {
        setProposalHTML((prev) => (prev ? patchCopyIntoHTML(prev, copy) : prev));
      }
    } catch {
      /* Copy failed — placeholder text stays */
    }
  };

  // ── Analyze Best Strategy ──

  const analyzeStrategy = async () => {
    if (loading) return;
    if (!apiKey) {
      setMessages((p) => [
        ...p,
        { role: "user", content: "Analyze which strategy is best for my client." },
        { role: "assistant", content: "No API key configured. The analysis feature requires an Anthropic API key." },
      ]);
      return;
    }

    setMessages((p) => [
      ...p,
      { role: "user", content: "Analyze which strategy is best for my client." },
    ]);
    setLoading(true);

    // Build a comprehensive data dump of all strategies
    const strategyData = model.strategies.map((s) => {
      const slots = s.slots.map((sl) => {
        const options = sl.options.slice(0, 8).map((opt) => {
          const segs = opt.segments.map((seg) => `${seg.origin}→${seg.destination} ${seg.marketingCarrier}${seg.flightNumber} ${seg.equipment || ""} ${seg.departureTime?.slice(11, 16) || ""}→${seg.arrivalTime?.slice(11, 16) || ""}`).join(" / ");
          const fares = opt.variants.map((v) => `${v.label} $${v.perAdult.toFixed(0)}pp ${v.refundable ? "[REFUNDABLE]" : "[NON-REF]"} ${v.fareTerms.changeSummary} | ${v.fareTerms.baggage} | ${v.fareTerms.seatType || "standard seat"}`).join("; ");
          return `  ${opt.carrierName} (${opt.carrier}) ${opt.totalDuration} ${opt.stops === 0 ? "nonstop" : opt.stops + " stop"} score:${opt.score}\n    Route: ${segs}\n    Fares: ${fares}`;
        }).join("\n");
        return `${sl.label} (${sl.coverage}):\n${options}`;
      }).join("\n\n");
      return `STRATEGY ${s.num}: ${s.label}\nTagline: ${s.tagline}\nPros: ${s.pros.join(", ")}\nCons: ${s.cons.join(", ")}\n\n${slots}`;
    }).join("\n\n---\n\n");

    const analysisPrompt = `You are a senior luxury travel advisor. Analyze ALL available strategies and options below for this trip: ${model.routeSummary} · ${model.dateSummary} · ${model.paxSummary}.

${strategyData}

Provide a thorough but concise analysis (max ~400 words) covering:
1. **Best overall strategy** and why (considering price, convenience, flexibility, routing quality)
2. **Best value pick** — the specific option + fare tier that offers the best bang for buck
3. **Premium pick** — if the client wants maximum comfort/flexibility, what to choose
4. **Watch-outs** — any gotchas like tight connections, red-eye flights, old aircraft, non-refundable-only options
5. **Your recommendation** — a clear 1-2 sentence recommendation

Use plain text. Be direct and expert. Reference specific carriers, flight numbers, and prices. Think like a luxury travel advisor who knows what matters.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: analysisPrompt }],
        }),
      });
      const d = await res.json();
      const txt = d.content?.find((b: { type: string }) => b.type === "text")?.text || "Unable to generate analysis.";
      setMessages((p) => [...p, { role: "assistant", content: txt }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Connection error — please retry." }]);
    }
    setLoading(false);
  };

  // ── Render ──

  if (proposalHTML) {
    return <ProposalViewer html={proposalHTML} onBack={() => setProposalHTML(null)} />;
  }

  const currentSlotCounts = Object.fromEntries(
    strategy.slots.map((sl) => [sl.id, getSlotCounts(strategy.id, sl.id)])
  );

  const quickPrompts = [
    "What's the best value?",
    "Show refundable options",
    "Add a business class option",
    "What's the cheapest combination?",
    "Show fastest routings",
    "Compare strategies for me",
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#080b14", color: "#e2e8f0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(8,11,20,0.97)" }}>
        <div className="flex items-center gap-[10px]">
          {onNewSearch && (
            <button
              onClick={onNewSearch}
              className="text-[10px] text-slate-500 bg-transparent border border-white/10 rounded px-2 py-1 cursor-pointer hover:text-slate-300 hover:border-white/20 transition-colors"
            >
              ← New Search
            </button>
          )}
          <button
            onClick={onBack}
            className="text-[10px] text-slate-500 bg-transparent border border-white/10 rounded px-2 py-1 cursor-pointer hover:text-slate-300 hover:border-white/20 transition-colors"
          >
            Simple View
          </button>
          <span className="text-indigo-400 text-[17px]">✦</span>
          <div>
            <div className="text-[13px] font-bold text-slate-50 tracking-tight">
              Flight Strategy Builder
            </div>
            <div className="text-[8px] text-slate-600 tracking-[2px] uppercase">
              {model.routeSummary} &nbsp;·&nbsp; {model.dateSummary} &nbsp;·&nbsp;{" "}
              {model.paxSummary}
            </div>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {model.strategies.map((s) => {
            const count = s.slots.reduce(
              (n, sl) => n + (sels[s.id]?.[sl.id]?.size || 0),
              0
            );
            return count > 0 ? (
              <div
                key={s.id}
                className="text-[8px] font-semibold flex items-center gap-1 rounded px-[7px] py-[2px]"
                style={{
                  color: s.color,
                  background: `${s.color}18`,
                  border: `1px solid ${s.color}35`,
                }}
              >
                S{s.num} · {count} fare{count > 1 ? "s" : ""}
              </div>
            ) : null;
          })}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Strategy workspace ── */}
        <div className="w-[58%] shrink-0 flex flex-col overflow-hidden" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Strategy tabs */}
          <div className="shrink-0 flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}>
            {model.strategies.map((s, i) => {
              const count = s.slots.reduce(
                (n, sl) => n + (sels[s.id]?.[sl.id]?.size || 0),
                0
              );
              const active = tab === i;
              return (
                <button
                  key={s.id}
                  onClick={() => setTab(i)}
                  className="flex-1 cursor-pointer border-none text-left bg-transparent transition-all duration-150"
                  style={{
                    padding: "10px 6px",
                    borderBottom: `2px solid ${active ? s.color : "transparent"}`,
                    background: active ? `${s.color}0c` : "transparent",
                  }}
                >
                  <div className="flex items-center gap-[5px] mb-[2px]">
                    <span
                      className="text-[15px] font-extrabold leading-none"
                      style={{ color: active ? s.color : "#374155" }}
                    >
                      {s.num}
                    </span>
                    {count > 0 && (
                      <span
                        className="text-[7px] font-bold rounded-[10px] px-[5px] py-[1px]"
                        style={{ color: s.color, background: `${s.color}20` }}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[10px] font-semibold leading-tight"
                    style={{ color: active ? "#f1f5f9" : "#4b5563" }}
                  >
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tagline + pros/cons */}
          <div className="shrink-0 px-[13px] pt-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="text-[11px] text-slate-500 mb-[5px] italic">{strategy.tagline}</div>
            <div className="flex gap-[14px] mb-2">
              <div className="flex-1">
                {strategy.pros.map((p, i) => (
                  <div key={i} className="text-[9px] text-emerald-400 mb-[2px]">
                    + {p}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                {strategy.cons.map((c, i) => (
                  <div key={i} className="text-[9px] text-red-400 mb-[2px]">
                    − {c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Slot tabs */}
          <SlotTabs
            strategy={strategy}
            slotCounts={currentSlotCounts}
            activeSlot={activeSlot}
            onSlotClick={(id) =>
              setActiveSlots((p) => ({ ...p, [strategy.id]: id }))
            }
          />

          {/* Active slot bar */}
          <div
            className="shrink-0 flex items-center gap-[7px]"
            style={{
              padding: "5px 13px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(0,0,0,0.12)",
            }}
          >
            <div
              className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background: strategy.color }}
            />
            <span
              className="text-[9px] font-bold tracking-[2px] uppercase"
              style={{ color: strategy.color }}
            >
              {activeSlotDef?.label}
            </span>
            <span className="text-[9px] text-gray-800">—</span>
            <span className="text-[9px] text-slate-600">{activeSlotDef?.coverage}</span>
            {(aiSuggested[strategy.id]?.[activeSlot] || []).length > 0 && (
              <span className="text-[8px] text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-[6px] py-[1px] rounded-[10px]">
                ✦ {aiSuggested[strategy.id][activeSlot].length} AI
              </span>
            )}
            {(currentSlotCounts[activeSlot]?.fares || 0) > 0 && (
              <span
                className="ml-auto text-[9px] font-semibold"
                style={{ color: strategy.color }}
              >
                {currentSlotCounts[activeSlot].fares} selected
              </span>
            )}
          </div>

          {/* Filter & Sort bar */}
          <div
            className="shrink-0 flex items-center gap-[6px] flex-wrap"
            style={{ padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)", background: "rgba(0,0,0,0.08)" }}
          >
            {/* Sort */}
            <div className="flex items-center rounded-[5px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["best", "cheapest", "fastest"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSortMode(m)}
                  className="border-none cursor-pointer text-[8px] font-semibold tracking-wide uppercase"
                  style={{
                    padding: "3px 8px",
                    background: sortMode === m ? `${strategy.color}25` : "transparent",
                    color: sortMode === m ? strategy.color : "#4b5563",
                  }}
                >
                  {m === "best" ? "Best" : m === "cheapest" ? "Price" : "Fast"}
                </button>
              ))}
            </div>

            <span className="text-slate-800">|</span>

            {/* Stops filter */}
            <select
              value={filterStops}
              onChange={(e) => setFilterStops(e.target.value as "any" | "0" | "1")}
              className="bg-transparent border border-white/8 rounded-[4px] text-[8px] text-slate-400 px-[5px] py-[3px] cursor-pointer"
              style={{ outline: "none" }}
            >
              <option value="any">Any stops</option>
              <option value="0">Nonstop</option>
              <option value="1">≤ 1 stop</option>
            </select>

            {/* Refundable filter */}
            <select
              value={filterRefundable}
              onChange={(e) => setFilterRefundable(e.target.value as "any" | "yes" | "no")}
              className="bg-transparent border border-white/8 rounded-[4px] text-[8px] text-slate-400 px-[5px] py-[3px] cursor-pointer"
              style={{ outline: "none" }}
            >
              <option value="any">All fares</option>
              <option value="yes">Refundable</option>
              <option value="no">Non-refundable</option>
            </select>

            {/* Airline filter — only show if >1 airline */}
            {availableAirlines.size > 1 && (
              <div className="flex items-center gap-[3px]">
                {Array.from(availableAirlines).map(([code, name]) => {
                  const active = filterAirlines.size === 0 || filterAirlines.has(code);
                  return (
                    <button
                      key={code}
                      onClick={() => {
                        setFilterAirlines((prev) => {
                          const next = new Set(prev);
                          if (next.has(code)) {
                            next.delete(code);
                          } else {
                            next.add(code);
                          }
                          // If all selected or none, clear the filter
                          if (next.size === availableAirlines.size) return new Set();
                          return next;
                        });
                      }}
                      className="flex items-center gap-[2px] rounded-[4px] border-none cursor-pointer"
                      style={{
                        padding: "2px 5px",
                        background: active ? "rgba(255,255,255,0.06)" : "transparent",
                        opacity: active ? 1 : 0.35,
                      }}
                      title={name}
                    >
                      <CarrierChip code={code} size={12} />
                      <span className="text-[7px] text-slate-500">{code}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <span className="text-[8px] text-slate-700 ml-auto">
              {displayOptions.length}/{activeSlotOptions.length}
            </span>
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto p-[8px_11px_4px]">
            {displayOptions.map((opt, idx) => {
              const optMinPrice = Math.min(...opt.variants.map((v) => v.perAdult));
              const isCheapest = optMinPrice === slotCheapestPrice;
              const delta = optMinPrice - slotCheapestPrice;

              // Recommended / More options divider
              const showDivider = hasMoreSection && idx === recommendedCount;

              return (
                <div key={opt.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 my-[8px]">
                      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                      <span className="text-[8px] text-slate-600 tracking-[1.5px] uppercase">More options</span>
                      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                    </div>
                  )}
                  {idx === 0 && hasMoreSection && (
                    <div className="text-[8px] text-slate-600 tracking-[1.5px] uppercase mb-[5px] px-1">
                      Recommended
                    </div>
                  )}
                  <OptionCard
                    option={opt}
                    color={strategy.color}
                    selectedVariantIndices={getSelectedVariantIndices(opt.id)}
                    onVariantToggle={toggleFare}
                    onSelectAll={toggleAllFares}
                    isAISuggested={isAISuggestedOpt(strategy.id, activeSlot, opt.id)}
                    isCheapest={isCheapest}
                    priceVsCheapest={delta}
                  />
                </div>
              );
            })}
            {displayOptions.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">
                {activeSlotOptions.length === 0
                  ? "No options available for this slot."
                  : "No options match your filters."}
              </div>
            )}
          </div>

          {/* Combo calculator — removed: distracting during slot-2/3 search */}
        </div>

        {/* ── Right: Chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Analyze button */}
          <div className="shrink-0 px-[13px] pt-[10px] pb-[6px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <button
              onClick={analyzeStrategy}
              disabled={loading}
              className="w-full rounded-[7px] border-none cursor-pointer text-white text-[10px] font-bold tracking-[1.5px] uppercase transition-all duration-200 flex items-center justify-center gap-[6px]"
              style={{
                padding: "9px 14px",
                background: loading ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #8b7355, #a08b6a)",
                opacity: loading ? 0.4 : 1,
                border: "1px solid rgba(139,115,85,0.3)",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #a08b6a, #b8a07d)"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #8b7355, #a08b6a)"; }}
            >
              <span style={{ fontSize: "13px" }}>✦</span>
              {loading ? "Analyzing…" : "Have Claude Analyze Best Strategy"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-[14px_14px_6px]">
            {messages.map((m, i) => (
              <ChatMsg
                key={i}
                m={m}
                strategies={model.strategies}
                sels={sels}
                onToggleFare={toggleSuggestionFare}
              />
            ))}
            {loading && (
              <div className="flex gap-2 mb-3">
                <div className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-extrabold bg-gray-900 text-indigo-400 border border-indigo-400/20">
                  ✦
                </div>
                <div
                  className="flex gap-1 items-center"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "10px 10px 10px 2px",
                    padding: "11px 14px",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-[5px] h-[5px] rounded-full bg-indigo-400"
                      style={{
                        animation: "cbPulse 1.2s ease-in-out infinite",
                        animationDelay: `${i * 200}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          {/* Build proposal CTA */}
          {totalFares > 0 && (
            <div className="shrink-0 px-[13px] py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex gap-[3px] flex-wrap mb-[7px]">
                {model.strategies.flatMap((s) =>
                  s.slots.map((sl) => {
                    const { fares } = getSlotCounts(s.id, sl.id);
                    if (!fares) return null;
                    return (
                      <span
                        key={`${s.id}-${sl.id}`}
                        className="text-[8px] rounded px-[7px] py-[2px] whitespace-nowrap"
                        style={{
                          background: `${s.color}18`,
                          color: s.color,
                          border: `1px solid ${s.color}30`,
                        }}
                      >
                        S{s.num} {sl.label} · {fares} fare{fares > 1 ? "s" : ""}
                      </span>
                    );
                  })
                )}
              </div>
              <button
                onClick={buildProposal}
                disabled={loading}
                className="w-full rounded-[7px] border-none cursor-pointer text-white text-[11px] font-bold tracking-[1.5px] uppercase transition-opacity duration-150"
                style={{
                  padding: "10px",
                  background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                  opacity: loading ? 0.4 : 1,
                }}
              >
                {loading ? "Building Proposal…" : "Build Client Comparison Proposal →"}
              </button>
            </div>
          )}

          {/* Quick prompts */}
          <div
            className="shrink-0 flex gap-[3px] flex-wrap"
            style={{
              padding: "5px 13px 3px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMsg(p)}
                disabled={loading}
                className="text-[9px] rounded-[20px] cursor-pointer whitespace-nowrap transition-all duration-100 hover:border-indigo-400 hover:text-indigo-300"
                style={{
                  padding: "3px 9px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#374155",
                  background: "transparent",
                  opacity: loading ? 0.4 : 1,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 13px" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMsg(input);
                }
              }}
              disabled={loading}
              placeholder="Ask anything — e.g. 'add a business class option' to get new cards…"
              className="flex-1 rounded-lg text-xs outline-none"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "9px 12px",
                color: "#e2e8f0",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(129,140,248,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
            />
            <button
              onClick={() => sendMsg(input)}
              disabled={loading || !input.trim()}
              className="rounded-lg border-none cursor-pointer font-bold text-white text-[13px] transition-opacity duration-150"
              style={{
                background: "#6366f1",
                padding: "9px 15px",
                opacity: loading || !input.trim() ? 0.35 : 1,
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cbPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1); }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
      `}</style>
    </div>
  );
}
