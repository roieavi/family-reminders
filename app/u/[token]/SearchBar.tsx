"use client";

import { useState } from "react";

export default function SearchBar({ token }: { token: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-member-token": token },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => null);
      setAnswer(res.ok ? (data?.answer ?? "שגיאה") : (data?.error ?? "שגיאה, נסה שוב"));
    } catch {
      setAnswer("שגיאה, נסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          placeholder="שאל, למשל: מתי התור שלי לרופא?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg border-2 border-black bg-lime-400 px-4 py-2 font-semibold text-black transition hover:bg-lime-300 disabled:opacity-50"
        >
          {loading ? "..." : "חפש"}
        </button>
      </div>
      {answer && (
        <p className="rounded-lg border-2 border-black bg-lime-50 p-3 text-sm">{answer}</p>
      )}
    </form>
  );
}
