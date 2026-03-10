"use client";
import { PassengerConfig } from "@/lib/types";

interface Props {
  passengers: PassengerConfig;
  onChange: (updates: Partial<PassengerConfig>) => void;
}

function Counter({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 w-16">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm"
      >
        -
      </button>
      <span className="w-6 text-center text-sm font-medium">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
      >
        +
      </button>
    </div>
  );
}

export default function PassengerSelector({ passengers, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <Counter
        label="Adults"
        value={passengers.adults}
        min={1}
        onChange={(v) => onChange({ adults: v })}
      />
      <Counter
        label="Children"
        value={passengers.children}
        onChange={(v) => onChange({ children: v })}
      />
      <Counter
        label="Infants"
        value={passengers.infants}
        onChange={(v) => onChange({ infants: v })}
      />
    </div>
  );
}
