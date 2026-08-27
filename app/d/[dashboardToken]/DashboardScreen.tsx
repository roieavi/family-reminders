"use client";

import { useCallback, useEffect, useState } from "react";
import { colorForMember } from "@/lib/memberColors";
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
  owner_member_id: string | null;
  event_members: { member_id: string }[];
}

interface DashboardChore {
  id: string;
  title: string;
  scheduled_time: string | null;
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
    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}`);
      if (res.status === 401) {
        setInvalid(true);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // Transient network failure (e.g. tablet WiFi blip) — skip this
      // cycle silently, the next poll will retry automatically.
    }
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
    try {
      await fetch(`/api/dashboard/${dashboardToken}/chores/${choreId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
    } catch {
      // Ignore — refresh() below reconciles with the true server state
      // regardless of whether the toggle request itself succeeded.
    } finally {
      refresh();
    }
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

  // Flatten chores into one row per assigned member (each has its own
  // completion state), sorted with untimed chores first and timed ones
  // after in ascending order — matching the events list's time-sorted feel.
  const choreRows = data.chores
    .flatMap((chore) =>
      chore.chore_members
        .map((cm) => data.members.find((m) => m.id === cm.member_id))
        .filter((member): member is DashboardMember => Boolean(member))
        .map((member) => ({
          key: `${chore.id}-${member.id}`,
          choreId: chore.id,
          memberId: member.id,
          memberName: member.name,
          title: chore.title,
          scheduledTime: chore.scheduled_time,
          done: chore.completed_member_ids.includes(member.id),
        }))
    )
    .sort((a, b) => {
      if (!a.scheduledTime && !b.scheduledTime) return 0;
      if (!a.scheduledTime) return -1;
      if (!b.scheduledTime) return 1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

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
          <h2 className="mb-3 text-xl font-bold">אירועים להיום</h2>
          {data.events.length === 0 ? (
            <p className="text-zinc-400">אין אירועים היום</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.events.map((event) => {
                const owner = event.owner_member_id
                  ? data.members.find((m) => m.id === event.owner_member_id)
                  : null;
                const color = owner ? colorForMember(data.members, owner.id) : null;
                const isPast = new Date(event.event_at) < now;
                return (
                  <li
                    key={event.id}
                    className={`flex items-center gap-3 rounded-xl border-r-4 p-3 transition ${
                      color ? `${color.light} ${color.border}` : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700"
                    } ${isPast ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`w-14 shrink-0 font-mono text-lg ${isPast ? "line-through" : ""}`}
                      dir="ltr"
                    >
                      {new Date(event.event_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jerusalem",
                      })}
                    </span>
                    <span className={`flex-1 text-lg ${isPast ? "line-through" : ""}`}>{event.title}</span>
                    <span
                      className={`text-sm font-semibold ${color ? color.text : "text-zinc-400"} ${
                        isPast ? "line-through" : ""
                      }`}
                    >
                      {owner ? owner.name : "כולם"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">לו״ז ומשימות</h2>
          {choreRows.length === 0 ? (
            <p className="text-zinc-400">אין משימות היום</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {choreRows.map((row) => (
                <li key={row.key}>
                  <button
                    onClick={() => toggleCompletion(row.choreId, row.memberId)}
                    aria-pressed={row.done}
                    className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 p-3 text-right transition dark:border-zinc-700"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-sm text-white transition ${
                        row.done ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 dark:border-zinc-600"
                      }`}
                      aria-hidden="true"
                    >
                      {row.done && "✓"}
                    </span>
                    <span
                      className={`w-14 shrink-0 font-mono text-lg ${row.done ? "line-through" : ""}`}
                      dir="ltr"
                    >
                      {row.scheduledTime ? row.scheduledTime.slice(0, 5) : ""}
                    </span>
                    <span className={`flex-1 text-lg ${row.done ? "text-zinc-400 line-through" : ""}`}>
                      {row.title}
                    </span>
                    <span
                      className={`text-sm font-semibold ${row.done ? "text-zinc-400 line-through" : ""}`}
                    >
                      {row.memberName}
                    </span>
                  </button>
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
