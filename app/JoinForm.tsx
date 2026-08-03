"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (trimmed) router.push(`/u/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-center text-sm text-zinc-500">
        יש לך כבר קישור אישי? הדבק אותו כאן, או פשוט פתח אותו ישירות מהמכשיר
        שלך.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        קוד/קישור אישי
        <input
          className="rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="הדבק כאן"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg border-2 border-black bg-lime-400 px-4 py-2 font-semibold text-black transition hover:bg-lime-300"
      >
        כניסה
      </button>
      <p className="text-center text-xs text-zinc-400">
        אין לך קישור? בקש מבן משפחה שכבר במערכת להוסיף אותך מהעמוד האישי שלו.
      </p>
    </form>
  );
}
