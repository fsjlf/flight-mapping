"use client";
import { useState, useRef, useCallback, KeyboardEvent } from "react";

interface Props {
  codes: string[];
  onChange: (codes: string[]) => void;
  placeholder: string;
  maxChips?: number;
  autoFocus?: boolean;
}

export default function AirportChipInput({
  codes,
  onChange,
  placeholder,
  maxChips = 5,
  autoFocus,
}: Props) {
  const [input, setInput] = useState("");
  const [highlightLast, setHighlightLast] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const atMax = codes.length >= maxChips;

  const commitCode = useCallback(
    (raw: string) => {
      const code = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length < 2 || code.length > 3) return;
      if (codes.includes(code)) return; // no duplicates
      if (codes.length >= maxChips) return;
      onChange([...codes, code]);
      setInput("");
      setHighlightLast(false);
    },
    [codes, onChange, maxChips]
  );

  const removeCode = useCallback(
    (idx: number) => {
      onChange(codes.filter((_, i) => i !== idx));
      setHighlightLast(false);
      inputRef.current?.focus();
    },
    [codes, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === " ") &&
      input.trim().length >= 2
    ) {
      e.preventDefault();
      commitCode(input);
      return;
    }

    if (e.key === "Backspace" && input === "" && codes.length > 0) {
      if (highlightLast) {
        removeCode(codes.length - 1);
      } else {
        setHighlightLast(true);
      }
      return;
    }

    // Any other key resets highlight
    if (highlightLast) setHighlightLast(false);
  };

  const handleInputChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z]/g, "");
    // Auto-commit when 3 chars typed and next char would overflow
    if (clean.length === 3 && input.length === 2) {
      // Don't auto-commit on typing — wait for Enter/Tab/Space
    }
    setInput(clean.slice(0, 3));
    setHighlightLast(false);
  };

  return (
    <div
      className="flex items-center flex-wrap gap-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent min-h-[36px] cursor-text"
      style={{ minWidth: codes.length > 0 ? 100 : undefined }}
      onClick={() => inputRef.current?.focus()}
    >
      {codes.map((code, i) => (
        <span
          key={code}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold uppercase transition-colors ${
            highlightLast && i === codes.length - 1
              ? "bg-red-100 text-red-700 border border-red-300"
              : "bg-gray-100 text-gray-700 border border-gray-200"
          }`}
        >
          {code}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeCode(i);
            }}
            className="ml-0.5 text-gray-400 hover:text-red-500 text-[10px] leading-none cursor-pointer border-none bg-transparent p-0"
            aria-label={`Remove ${code}`}
          >
            ×
          </button>
        </span>
      ))}
      {!atMax && (
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim().length >= 2) commitCode(input);
          }}
          placeholder={codes.length === 0 ? placeholder : ""}
          maxLength={3}
          autoFocus={autoFocus}
          className="flex-1 min-w-[40px] border-none outline-none text-sm uppercase bg-transparent p-0"
          style={{ width: codes.length === 0 ? "100%" : 40 }}
        />
      )}
      {atMax && (
        <span className="text-[10px] text-gray-400 ml-1" title="Maximum 5 airports per field">
          max
        </span>
      )}
    </div>
  );
}
