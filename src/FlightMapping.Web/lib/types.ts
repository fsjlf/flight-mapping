// --- Enums (serialized as strings via JsonStringEnumConverter) ---
export type CabinClass = "Economy" | "PremiumEconomy" | "Business" | "First";
export type SearchPriority = "Price" | "Duration" | "Comfort" | "Balanced";
export type FareType = "Published" | "Negotiated" | "WebFare";
export type TripType =
  | "OneWay"
  | "RoundTrip"
  | "OpenJawOrigin"
  | "OpenJawDestination"
  | "DoubleOpenJaw"
  | "MultiCity"
  | "CircleTrip";
export type TicketingStrategyType =
  | "SingleTicket"
  | "SeparateOneWays"
  | "OutboundReturnSplit"
  | "HybridRtPlusOw"
  | "CarrierOptimized";
export type DepartureTimeWindow = "Any" | "Morning" | "Afternoon" | "Evening" | "RedEye";

// --- Input ---
export interface SearchRequest {
  segments: SegmentInput[];
  passengers: PassengerConfig;
  preferences?: SearchPreferences;
}

export interface SegmentInput {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  cabinOverride?: CabinClass;
  timePreference?: DepartureTimeWindow;
}

export interface PassengerConfig {
  adults: number;
  children: number;
  infants: number;
  infantsWithSeat: number;
}

export interface SearchPreferences {
  cabin?: CabinClass;           // single cabin (legacy / fallback)
  cabins?: CabinClass[];        // multi-cabin search — sent to BFM as multiple CabinPref entries
  preferredCarriers?: string[];
  excludedCarriers?: string[];
  maxStops?: number;
  maxBudgetPerPerson?: number;
  currencyCode?: string;
  priority?: SearchPriority;
  includeBrandedFares?: boolean;
}

// --- Output ---
export interface SearchResponse {
  searchId: string;
  classification: TripClassification;
  itineraries: EnrichedItinerary[];
  metadata: SearchMetadata;
  splitPnrOpportunities?: SplitPnrDetection[];
}

export interface TripClassification {
  type: TripType;
  singleTicketPossible: boolean;
  recommendedStrategies: TicketingStrategyType[];
  reasoning: string;
}

export interface EnrichedItinerary {
  id: string;
  strategyType: TicketingStrategyType;
  strategyDescription: string;
  segments: EnrichedSegment[];
  totalDurationMinutes: number;
  totalDurationFormatted: string;
  totalMilesFlown: number;
  pricing: ItineraryPricing;
  farePolicy: FarePolicy;
  scores: ItineraryScores;
  highlights: string[];
  warnings: string[];
  rank: number;
  validatingCarrier: string;
  eTicketable: boolean;
  governingCarriers?: string;
  pricingSource: string;
  coveredSegmentIndices: number[];
}

export interface EnrichedSegment {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  durationFormatted: string;
  marketingCarrier: string;
  operatingCarrier: string;
  flightNumber: string;
  equipment: string;
  bookingClass: string;
  cabin: CabinClass;
  fareBasisCode: string;
  brand?: BrandInfo;
  legs: EnrichedLeg[];
  stops: number;
  connectionTimeMinutes?: number;
  connectionTimeFormatted?: string;
}

export interface EnrichedLeg {
  origin: string;
  destination: string;
  originCity?: string;
  originCountry?: string;
  destinationCity?: string;
  destinationCountry?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  marketingCarrier: string;
  marketingFlightNumber: number;
  operatingCarrier: string;
  operatingFlightNumber: number;
  disclosure?: string;
  flightNumber: string;
  equipment: string;
  bookingClass: string;
  mealCode?: string;
  seatsAvailable: number;
  totalMilesFlown: number;
  stopCount: number;
  connectionTimeToNextMinutes?: number;
}

export interface BrandInfo {
  name: string;
  tier: number;
  features: { name: string; application?: string; serviceGroup?: string; serviceType?: string }[];
}

export interface ItineraryPricing {
  totalPrice: number;
  basePrice: number;
  taxesAndFees: number;
  currencyCode: string;
  baseFareCurrency: string;
  equivalentAmount?: number;
  equivalentCurrency?: string;
  pricePerAdult: number;
  priceFormatted: string;
  taxes: { code: string; amount: number; currency: string }[];
  passengerBreakdown: { passengerType: string; count: number; nonRefundable: boolean }[];
}

export interface FarePolicy {
  nonRefundable: boolean;
  vita: boolean;
}

export interface ItineraryScores {
  overall: number;
  valueScore: number;
  scheduleScore: number;
  durationScore: number;
  comfortScore: number;
  reliabilityScore: number;
}

export interface SearchMetadata {
  totalResults: number;
  strategiesExecuted: number;
  apiCallsMade: number;
  searchDurationMs: number;
  strategyResults: StrategyResult[];
  sabreMessages: string[];
}

export interface StrategyResult {
  strategyId: string;
  type: string;
  resultCount: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

// --- Hybrid Package Breakdown ---
export interface HybridPackageBreakdown {
  totalPerAdult: number;
  packagePerAdult: number;
  packageLabel: string;
  owLegs: { label: string; pricePerAdult: number }[];
}

// --- Slim Export Types (for JSON export — optimized for AI conversation) ---

/** Compact segment: no nested legs, no brand features, no tax breakdown */
export interface SlimSegment {
  from: string;
  to: string;
  depart: string;
  arrive: string;
  duration: string;
  stops: number;
  carrier: string;
  operated?: string; // only if different from marketing carrier
  flight: string;
  cabin: string;
  bookingClass: string;
  equipment: string;
  brand?: string; // brand name only (no features array)
}

/** Summary of one fare option for a flight combo */
export interface SlimFare {
  name: string; // brand name or booking class
  perAdult: number;
  refundable: boolean;
}

/** One unique flight combination with all fare options summarized */
export interface SlimItinerary {
  segments: SlimSegment[];
  totalDuration: string;
  price: number; // cheapest fare, per adult
  currency: string;
  score: number;
  carrier: string; // validating carrier
  refundable: boolean;
  fares: SlimFare[]; // all distinct fare options for this flight combo
}

export interface SearchHistoryEntry {
  searchId: string;
  timestamp: string;
  request: {
    segments: SegmentInput[];
    passengers: PassengerConfig;
    preferences?: SearchPreferences;
  };
  results: {
    tripType: string;
    roundTrip: SlimItinerary[];
    mixAndMatch: {
      leg: number;
      route: string;
      date: string;
      options: SlimItinerary[];
    }[];
    smartPackages: {
      covers: string;
      options: SlimItinerary[];
    }[];
  };
  counts: {
    total: number;
    roundTrip: number;
    mixAndMatch: number;
    smartPackages: number;
  };
}

export interface SearchHistoryExport {
  exportedAt: string;
  sessionSearchCount: number;
  searches: SearchHistoryEntry[];
}

// --- Split PNR / Waterfall Types ---

export interface SplitPnrDetection {
  opportunityDetected: boolean;
  flightKey: string;
  singlePaxPrice: number;
  singlePaxRbd: string;
  groupPricePerPerson: number;
  groupRbd: string;
  deltaPerPerson: number;
  totalPassengers: number;
  minEstimatedSavings: number;
  maxEstimatedSavings: number;
  savingsBadge: "green" | "yellow" | "none";
  cheapSeatsAvailable?: number; // exact auth cap from incremental probing
}

export interface FareClassInfo {
  rbd: string;
  authCap: number;
  farePerPerson: number;
  fareBasisCode: string;
  cabin: CabinClass;
  brandName?: string;
  rulesSummary?: string;
}

export interface GroupFare {
  rbd: string;
  farePerPerson: number;
  total: number;
}

export interface WaterfallInput {
  cabinPhysicalSeats: number;
  totalPassengers: number;
  fareClasses: FareClassInfo[];
  groupFare: GroupFare;
}

export interface WaterfallAllocation {
  rbd: string;
  count: number;
  farePerPerson: number;
  subtotal: number;
  brandName?: string;
  rulesSummary?: string;
  fareBasisCode?: string;
}

export interface ClassSnapshot {
  rbd: string;
  authRemaining: number;
  physicalRemaining: number;
  effectiveAvailable: number;
  fare: number;
  bindingConstraint: "cap" | "physical" | "both";
}

export interface WaterfallSnapshot {
  label: string;
  physicalRemaining: number;
  classes: ClassSnapshot[];
}

export interface WaterfallResult {
  feasible: boolean;
  failureReason?: string;
  allocations: WaterfallAllocation[];
  totalCost: number;
  groupCost: number;
  savings: number;
  savingsPercent: number;
  snapshots: WaterfallSnapshot[];
}

export interface PriceBreakpoint {
  passengerCount: number;
  rbd: string;
  pricePerPerson: number;
  inferredAuthCap: number;
}

export interface PnrGroup {
  pnrNumber: number;
  rbd: string;
  passengerCount: number;
  farePerPerson: number;
  subtotal: number;
  brandName?: string;
  rulesSummary?: string;
}

export interface SingleBookingOption {
  rbd: string;
  pricePerPerson: number;
  total: number;
  brandName?: string;
  rulesSummary?: string;
}

export interface SplitBookingOption {
  pnrs: PnrGroup[];
  total: number;
  averagePerPerson: number;
}

export interface SplitPnrAnalysis {
  flightKey: string;
  carrier: string;
  route: string;
  cabin: CabinClass;
  totalPassengers: number;
  singleBooking: SingleBookingOption;
  recommendedSplit: SplitBookingOption;
  waterfall: WaterfallResult;
  savings: number;
  savingsPercent: number;
  averagePricePerPerson: number;
  tradeOffs: string[];
  priceBreakpoints: PriceBreakpoint[];
}
