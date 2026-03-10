"use client";
import { useState } from "react";
import { SearchRequest } from "@/lib/types";
import { parseNaturalLanguage } from "@/lib/parser";

interface Props {
  onParsed: (request: Partial<SearchRequest>) => void;
}

export default function NaturalLanguageInput({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{
    segments: number;
    warnings: string[];
  } | null>(null);

  const handleParse = () => {
    if (!text.trim()) return;
    const result = parseNaturalLanguage(text);
    onParsed(result.request);

    setFeedback({
      segments: result.request.segments?.length || 0,
      warnings: result.warnings,
    });
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste your itinerary here, e.g.:\n\nNYC to London March 20, London to Paris March 25, back to NYC March 30, 2 adults business`}
        rows={5}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />
      <button
        onClick={handleParse}
        disabled={!text.trim()}
        className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
      >
        Parse & Fill Form
      </button>

      {feedback && (
        <div className="text-sm">
          {feedback.segments > 0 ? (
            <p className="text-green-600">
              Parsed {feedback.segments} segment{feedback.segments > 1 ? "s" : ""}
              {" "}&mdash; review the form below and click Search.
            </p>
          ) : (
            <p className="text-amber-600">
              Could not parse any segments. Try a format like &quot;NYC to London March 20&quot;.
            </p>
          )}
          {feedback.warnings.map((w, i) => (
            <p key={i} className="text-amber-600">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
