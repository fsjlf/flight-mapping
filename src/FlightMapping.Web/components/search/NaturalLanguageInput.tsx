"use client";
import { useState } from "react";
import { SearchRequest } from "@/lib/types";
import { parseWithAI } from "@/lib/api";

interface Props {
  onParsed: (request: Partial<SearchRequest>) => void;
}

export default function NaturalLanguageInput({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await parseWithAI(text);
      onParsed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Describe your trip in plain English, e.g.:\n\n"2 adults flying business from NYC to London March 20, back March 27, prefer nonstop"`}
        rows={5}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        disabled={loading}
      />
      <button
        onClick={handleParse}
        disabled={!text.trim() || loading}
        className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
      >
        {loading ? "Parsing with AI..." : "Parse & Fill Form"}
      </button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
