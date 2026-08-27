"use client";

import { useCallback, useEffect, useState } from "react";
import { colorForMember, initials } from "@/lib/memberColors";
import { formatHebrewDate } from "@/lib/hebrewDate";

interface DashboardMember {
  id: string;
  name: string;
}

interface DashboardEvent {
  id: string;
  title: string;
  event_at: string;
  applies_to_all: boolean;
  event_members: { member_id: string }[];
}

interface DashboardChore {
  id: string;
  title: string;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}

interface DashboardNote {
  id: string;
  text: string;
  member_id: string;
}

interface DashboardData {
  family: { name: string; location_label: string | null };
  members: DashboardMember[];
  events: DashboardEvent[];
  chores: DashboardChore[];
  notes: DashboardNote[];
  weather: { temperatureC: number; icon: string; description: string } | null;
}

const DATA_REFRESH_MS = 60_000;

export default function DashboardScreen({ dashboardToken }: { dashboardToken: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/dashboard/${dashboardToken}`);
    if (res.status === 401) {
      setInvalid(true);
      return;
    }
    if (!res.ok) return;
    const json = await res.json();
    setData(json);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    refresh();
    const dataTimer = setInterval(refresh, DATA_REFRESH_MS);
    return () => clearInterval(dataTimer);
  }, [refresh]);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  async function toggleCompletion(choreId: string, memberId: string) {
    await fetch(`/api/dashboard/${dashboardToken}/chores/${choreId}/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    refresh();
  }

  if (invalid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-400">קישור דשבורד לא תקין</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-400">טוען...</p>
      </main>
    );
  }

  const time = now.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  const gregorianDate = now.toLocaleDateString("he-IL", {
    dateStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  const hebrewDate = formatHebrewDate(now);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between gap-4 bg-gradient-to-l from-indigo-500 to-violet-600 px-8 py-4 text-white">
        <span className="text-4xl font-extrabold" dir="ltr">
          {time}
        </span>
        <span className="text-lg font-semibold">
          {hebrewDate} | {gregorianDate}
        </span>
        {data.weather && (
          <span className="text-2xl font-semibold">
            {data.weather.icon} {data.weather.temperatureC}°
          </span>
        )}
      </header>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden p-4">
        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">לו״ז היום</h2>
          {data.events.length === 0 ? (
            <p className="text-zinc-400">אין אירועים היום</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.events.map((event) => {
                const relevantMembers = event.applies_to_all
                  ? data.members
                  : data.members.filter((m) => event.event_members.some((em) => em.member_id === m.id));
                return (
                  <li key={event.id} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-mono text-lg" dir="ltr">
                      {new Date(event.event_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jerusalem",
                      })}
                    </span>
                    {relevantMembers.map((m) => (
                      <span
                        key={m.id}
                        className={`h-3 w-3 shrink-0 rounded-full ${colorForMember(data.members, m.id).bg}`}
                        title={m.name}
                      />
                    ))}
                    <span className="text-lg">{event.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">תורנויות ומשימות</h2>
          {data.chores.length === 0 ? (
            <p className="text-zinc-400">אין משימות היום</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.chores.map((chore) => (
                <li key={chore.id} className="flex items-center gap-2">
                  <span className="flex-1 text-lg">{chore.title}</span>
                  {chore.chore_members.map((cm) => {
                    const member = data.members.find((m) => m.id === cm.member_id);
                    if (!member) return null;
                    const done = chore.completed_member_ids.includes(member.id);
                    const color = colorForMember(data.members, member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleCompletion(chore.id, member.id)}
                        aria-pressed={done}
                        title={member.name}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white transition ${color.bg} ${
                          done ? "opacity-40" : ""
                        }`}
                      >
                        {done ? "✓" : initials(member.name)}
                      </button>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.notes.length > 0 && (
        <div className="overflow-hidden whitespace-nowrap border-t border-zinc-200 bg-white py-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="animate-marquee inline-block">
            {data.notes.map((note) => (
              <span key={note.id} className="mx-8 text-lg">
                📌 {note.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
