"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyName, memberName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה");
        return;
      }
      router.push(`/u/${data.token}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-center text-sm text-zinc-500">
        זו הפעם הראשונה - בואו נגדיר את המשפחה שלכם
      </p>
      <label className="flex flex-col gap-1 text-sm">
        שם המשפחה
        <input
          className="rounded border px-3 py-2"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          placeholder="לדוגמה: משפחת כהן"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        השם שלך
        <input
          className="rounded border px-3 py-2"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          placeholder="השם שלך"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "יוצר..." : "צור את המערכת"}
      </button>
    </form>
  );
}
