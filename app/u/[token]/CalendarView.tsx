"use client";

import { useState } from "react";
import Modal from "./Modal";
import {
  EventForm,
  reminderLabel,
  toIsraelDateTimeParts,
  type EventItem,
  type MemberSummary,
} from "./Dashboard";

const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CalendarView({
  events,
  members,
  headers,
  onRefresh,
}: {
  events: EventItem[];
  members: MemberSummary[];
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const todayKey = toIsraelDateTimeParts(new Date().toISOString()).date;
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth - 1);
  const [popup, setPopup] = useState<{ mode: "view" | "add"; dateKey: string } | null>(null);

  const memberName_ = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const eventsByDay = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = toIsraelDateTimeParts(event.event_at).date;
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  function goToMonth(delta: number) {
    const total = year * 12 + month + delta;
    setYear(Math.floor(total / 12));
    setMonth(((total % 12) + 12) % 12);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const popupEvents = popup ? (eventsByDay.get(popup.dateKey) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => goToMonth(-1)}
          aria-label="חודש קודם"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ‹
        </button>
        <p className="font-bold">{monthLabel}</p>
        <button
          onClick={() => goToMonth(1)}
          aria-label="חודש הבא"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayEvents = eventsByDay.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          return (
            <button
              key={dateKey}
              onClick={() => setPopup({ mode: dayEvents.length > 0 ? "view" : "add", dateKey })}
              className={`flex aspect-square flex-col items-center justify-center rounded-full text-sm transition ${
                isToday
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "text-zinc-700 hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <span>{day}</span>
              {dayEvents.length > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isToday ? "bg-white" : "bg-indigo-500"}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {popup?.mode === "view" && (
        <Modal onClose={() => setPopup(null)} title="מועדים">
          <div className="flex flex-col gap-3">
            {popupEvents.map((event) => (
              <div key={event.id} className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-700">
                <p className="font-semibold">{event.title}</p>
                <p className="text-sm text-zinc-500">
                  {new Date(event.event_at).toLocaleString("he-IL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jerusalem",
                  })}
                </p>
                {event.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{event.description}</p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  רלוונטי ל:{" "}
                  {event.applies_to_all
                    ? "כולם"
                    : event.event_members.map((em) => memberName_(em.member_id)).join(", ")}
                </p>
                {event.reminders.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">
                    תזכורות:{" "}
                    {event.reminders
                      .map((r) => reminderLabel(event.event_at, r.remind_at))
                      .join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {popup?.mode === "add" && (
        <Modal onClose={() => setPopup(null)} title="הוספת מועד">
          <EventForm
            headers={headers}
            members={members}
            initialDate={popup.dateKey}
            onDone={() => {
              setPopup(null);
              onRefresh();
            }}
            onCancel={() => setPopup(null)}
          />
        </Modal>
      )}
    </div>
  );
}
