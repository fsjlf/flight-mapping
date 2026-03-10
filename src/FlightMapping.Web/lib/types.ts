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
  cabin?: CabinClass;
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
