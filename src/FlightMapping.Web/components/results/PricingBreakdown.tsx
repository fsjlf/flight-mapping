import { ItineraryPricing } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  pricing: ItineraryPricing;
}

export default function PricingBreakdown({ pricing }: Props) {
  const currency = pricing.currencyCode;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-xs font-medium text-gray-500 mb-3">
        Pricing Breakdown
      </h4>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Base fare</span>
          <span className="text-gray-900">
            {formatCurrency(pricing.basePrice, currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Taxes & fees</span>
          <span className="text-gray-900">
            {formatCurrency(pricing.taxesAndFees, currency)}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">
            {formatCurrency(pricing.totalPrice, currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-blue-700">
          <span>Per adult</span>
          <span className="font-semibold">
            {formatCurrency(pricing.pricePerAdult, currency)}
          </span>
        </div>
      </div>

      {/* Passenger breakdown */}
      {pricing.passengerBreakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Per passenger</div>
          {pricing.passengerBreakdown.map((pax, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>
                {pax.count}x {pax.passengerType}
                {pax.nonRefundable && (
                  <span className="text-amber-600 ml-1">Non-ref</span>
                )}
              </span>
              <span>{formatCurrency(pricing.pricePerAdult, currency)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top taxes */}
      {pricing.taxes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Tax detail</div>
          {pricing.taxes.slice(0, 5).map((tax, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-500">
              <span>{tax.code}</span>
              <span>{formatCurrency(tax.amount, tax.currency)}</span>
            </div>
          ))}
          {pricing.taxes.length > 5 && (
            <div className="text-xs text-gray-400 mt-1">
              +{pricing.taxes.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
