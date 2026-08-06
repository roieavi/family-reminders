"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { REMINDER_PRESETS } from "@/lib/reminders";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import { toIsraelDateTimeParts, timeOfDayGreeting } from "@/lib/israelTime";
import { formatCountdown } from "@/lib/countdown";
import { colorForMember } from "@/lib/memberColors";
import SearchBar from "./SearchBar";
import PushSubscribeButton from "./PushSubscribeButton";
import CalendarView from "./CalendarView";
import Modal from "./Modal";
import GridView from "./GridView";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import ToggleSwitch from "./ToggleSwitch";
import SideMenu from "./SideMenu";

export { toIsraelDateTimeParts };

export interface MemberSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_at: string;
  applies_to_all: boolean;
  created_by: string;
  event_members: { member_id: string }[];
  reminders: { id: string; remind_at: string; sent: boolean }[];
}

export default function Dashboard({
  token,
  memberId,
  memberName,
}: {
  token: string;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "calendar">("list");
  const [greeting, setGreeting] = useState("שלום");

  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const refresh = useCallback(async () => {
    setLoading(true);
    const [membersRes, eventsRes] = await Promise.all([
      fetch("/api/members", { headers }),
      fetch("/api/events", { headers }),
    ]);
    const membersData = await membersRes.json();
    const eventsData = await eventsRes.json();
    setMembers(membersData.members ?? []);
    setEvents(eventsData.events ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(MEMBER_TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads current time, must run after mount
    setGreeting(timeOfDayGreeting());
  }, []);

  const visibleEvents = events.filter((e) => {
    if (scope === "all") return true;
    return e.applies_to_all || e.event_members.some((em) => em.member_id === memberId);
  });

  const nextEvent = visibleEvents[0] ?? null;

  async function deleteEvent(id: string) {
    if (!confirm("למחוק את המועד?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE", headers });
    refresh();
  }

  return (
    <SideMenu>
      {({ open }) => (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8">
      <header className="relative -mx-4 overflow-hidden rounded-b-3xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 pt-10 pb-20 text-white">
        <div className="pointer-events-none absolute -top-10 -left-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute top-14 -right-6 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <button
              type="button"
              onClick={open}
              aria-label="פתח תפריט"
              className="mb-2 flex h-8 w-8 items-center justify-center"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            <h1 className="text-4xl font-extrabold">
              {greeting}, {memberName}
            </h1>
          </div>
          <PushSubscribeButton token={token} />
        </div>
      </header>

      <div className="relative z-10 -mt-12 rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-800">
        <p className="text-xs font-semibold text-zinc-400">האירוע הקרוב</p>
        {nextEvent ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{nextEvent.title}</p>
              <p className="text-sm text-zinc-500">
                {new Date(nextEvent.event_at).toLocaleString("he-IL", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Jerusalem",
                })}
              </p>
            </div>
            <CountdownBadge countdown={formatCountdown(nextEvent.event_at)} size="lg" />
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">אין מועדים קרובים</p>
        )}
      </div>

      <div className="mt-4">
        <SearchBar token={token} />
      </div>

      <section className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setScope("mine")}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition ${scope === "mine" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          שלי
        </button>
        <button
          onClick={() => setScope("all")}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition ${scope === "all" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          כולם
        </button>
        <button
          onClick={() => setViewMode("list")}
          aria-label="תצוגת רשימה"
          aria-pressed={viewMode === "list"}
          className={`rounded-lg p-1.5 transition ${viewMode === "list" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <button
          onClick={() => setViewMode("grid")}
          aria-label="תצוגת קוביות"
          aria-pressed={viewMode === "grid"}
          className={`rounded-lg p-1.5 transition ${viewMode === "grid" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
          </svg>
        </button>
        <button
          onClick={() => setViewMode("calendar")}
          aria-label="תצוגת לוח שנה"
          aria-pressed={viewMode === "calendar"}
          className={`rounded-lg p-1.5 transition ${viewMode === "calendar" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="3" x2="8" y2="7" />
            <line x1="16" y1="3" x2="16" y2="7" />
          </svg>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowAddEvent((v) => !v)}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          + הוסף מועד
        </button>
      </section>

      {showAddEvent && (
        <Modal onClose={() => setShowAddEvent(false)} title="הוספת מועד">
          <EventForm
            headers={headers}
            members={members}
            onDone={() => {
              setShowAddEvent(false);
              refresh();
            }}
            onCancel={() => setShowAddEvent(false)}
          />
        </Modal>
      )}

      <div className="mt-4">
        {viewMode === "calendar" ? (
          <CalendarView
            events={visibleEvents}
            members={members}
            headers={headers}
            onRefresh={refresh}
          />
        ) : viewMode === "grid" ? (
          loading ? (
            <p className="text-center text-zinc-400">טוען...</p>
          ) : visibleEvents.length === 0 ? (
            <p className="text-center text-zinc-400">אין מועדים להצגה</p>
          ) : (
            <GridView
              events={visibleEvents}
              members={members}
              headers={headers}
              onRefresh={refresh}
              onDelete={deleteEvent}
            />
          )
        ) : loading ? (
          <p className="text-center text-zinc-400">טוען...</p>
        ) : visibleEvents.length === 0 ? (
          <p className="text-center text-zinc-400">אין מועדים להצגה</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleEvents.map((event) => {
              const countdown = formatCountdown(event.event_at);
              const relevantMembers = event.applies_to_all
                ? members
                : members.filter((m) =>
                    event.event_members.some((em) => em.member_id === m.id)
                  );
              return (
                <li key={event.id} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
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
                      {event.reminders.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-400">
                          תזכורות:{" "}
                          {event.reminders
                            .map((r) => reminderLabel(event.event_at, r.remind_at))
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <CountdownBadge countdown={countdown} size="sm" />
                      <div className="flex -space-x-2">
                        {event.applies_to_all ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-500">
                            כולם
                          </span>
                        ) : (
                          relevantMembers.map((m) => (
                            <Avatar key={m.id} name={m.name} color={colorForMember(members, m.id)} size="sm" ring />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      onClick={() => setEditingEventId(event.id)}
                      className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-xs font-semibold text-red-500 transition hover:text-red-700"
                      aria-label="מחק מועד"
                    >
                      מחק
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editingEventId &&
        (() => {
          const editingEvent = visibleEvents.find((e) => e.id === editingEventId);
          if (!editingEvent) return null;
          return (
            <Modal onClose={() => setEditingEventId(null)} title="עריכת מועד">
              <EventForm
                headers={headers}
                members={members}
                event={editingEvent}
                onDone={() => {
                  setEditingEventId(null);
                  refresh();
                }}
                onCancel={() => setEditingEventId(null)}
              />
            </Modal>
          );
        })()}

      <section className="mt-6 border-t-2 border-black pt-4 dark:border-zinc-300">
        <button
          onClick={() => setShowMembers((v) => !v)}
          className="flex w-full items-center justify-between"
          aria-expanded={showMembers}
        >
          <h2 className="font-bold">בני המשפחה</h2>
          <span
            className={`transition-transform ${showMembers ? "-rotate-90" : ""}`}
            aria-hidden="true"
          >
            ◂
          </span>
        </button>

        {showMembers && (
          <>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => setShowAddMember((v) => !v)}
                className="rounded-lg border-2 border-black px-2 py-1 text-sm font-semibold transition hover:bg-indigo-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
              >
                + הוסף בן משפחה
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  headers={headers}
                  isSelf={m.id === memberId}
                  onEmailSaved={refresh}
                  onTokenRegenerated={(newToken) => {
                    if (m.id === memberId) {
                      router.push(`/u/${newToken}`);
                    } else {
                      refresh();
                    }
                  }}
                />
              ))}
            </ul>
            {showAddMember && (
              <AddMemberForm
                headers={headers}
                onDone={() => {
                  refresh();
                }}
              />
            )}
          </>
        )}
      </section>
    </main>
      )}
    </SideMenu>
  );
}

function diffMinutes(eventAt: string, remindAt: string): number {
  return Math.round((new Date(eventAt).getTime() - new Date(remindAt).getTime()) / 60_000);
}

export function reminderLabel(eventAt: string, remindAt: string): string {
  const minutes = diffMinutes(eventAt, remindAt);
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutes);
  return preset?.label ?? `${minutes} דקות לפני`;
}

export function EventForm({
  headers,
  members,
  event,
  initialDate,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  event?: EventItem;
  initialDate?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialDateTime = event ? toIsraelDateTimeParts(event.event_at) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(initialDateTime?.date ?? initialDate ?? "");
  const [eventTime, setEventTime] = useState(initialDateTime?.time ?? "");
  const [appliesToAll, setAppliesToAll] = useState(event?.applies_to_all ?? true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    event ? event.event_members.map((em) => em.member_id) : []
  );
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    event ? event.reminders.map((r) => diffMinutes(event.event_at, r.remind_at)) : [60 * 24]
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    event ? event.reminders.length > 0 : false
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function toggleReminder(minutes: number) {
    setSelectedReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          title,
          description,
          event_at: new Date(`${eventDate}T${eventTime}`).toISOString(),
          applies_to_all: appliesToAll,
          member_ids: selectedMembers,
          reminder_minutes: remindersEnabled ? selectedReminders : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const fieldLabel = "block text-xs font-semibold tracking-wide text-zinc-400";
  const fieldInput =
    "w-full border-b-2 border-zinc-200 bg-transparent py-2 focus:border-indigo-500 focus:outline-none dark:border-zinc-700";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>כותרת</span>
        <input
          className={fieldInput}
          placeholder="למשל: תור לרופא שיניים"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>תיאור</span>
        <textarea
          className={fieldInput}
          placeholder="אופציונלי"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className={fieldLabel}>תאריך</span>
          <input
            type="date"
            className={fieldInput}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={fieldLabel}>שעה</span>
          <input
            type="time"
            className={fieldInput}
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            required
          />
        </label>
      </div>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>שיוך</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">רלוונטי לכולם</span>
            <ToggleSwitch checked={appliesToAll} onChange={setAppliesToAll} />
          </div>
          {!appliesToAll &&
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700"
              >
                <span className="text-sm">{m.name}</span>
                <ToggleSwitch
                  checked={selectedMembers.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
              </div>
            ))}
        </div>
      </div>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>תזכורת</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">תזכורת</span>
            <ToggleSwitch checked={remindersEnabled} onChange={setRemindersEnabled} />
          </div>
          {remindersEnabled &&
            REMINDER_PRESETS.map((p) => (
              <div
                key={p.minutes}
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700"
              >
                <span className="text-sm">{p.label}</span>
                <ToggleSwitch
                  checked={selectedReminders.includes(p.minutes)}
                  onChange={() => toggleReminder(p.minutes)}
                />
              </div>
            ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "שומר..." : "שמור מועד"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-1 text-sm font-semibold text-zinc-400 transition hover:text-zinc-600"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

function AddMemberForm({
  headers,
  onDone,
}: {
  headers: Record<string, string>;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newLink, setNewLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers,
      body: JSON.stringify({ name, email: email || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "שגיאה");
      return;
    }
    const url = `${window.location.origin}/u/${data.member.token}`;
    setNewLink(url);
    setName("");
    setEmail("");
    onDone();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-black p-3 dark:border-zinc-300">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="שם בן המשפחה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-lg border-2 border-black bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:border-zinc-300"
        >
          צור קישור אישי
        </button>
      </form>
      {newLink && (
        <div className="rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2 text-sm dark:border-indigo-700 dark:bg-indigo-950">
          <p>שלח/י את הקישור הזה לבן המשפחה - זו הפעם היחידה שהוא מוצג:</p>
          <p className="mt-1 break-all font-mono text-xs">{newLink}</p>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  headers,
  isSelf,
  onEmailSaved,
  onTokenRegenerated,
}: {
  member: MemberSummary;
  headers: Record<string, string>;
  isSelf: boolean;
  onEmailSaved: () => void;
  onTokenRegenerated: (newToken: string) => void;
}) {
  const [email, setEmail] = useState(member.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);

  async function saveEmail() {
    setSavingEmail(true);
    try {
      await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ email: email || null }),
      });
      onEmailSaved();
    } finally {
      setSavingEmail(false);
    }
  }

  async function regenerateToken() {
    if (
      !confirm(
        isSelf
          ? "ליצור קישור חדש? הקישור הנוכחי (שאתה משתמש בו עכשיו) יפסיק לעבוד מיד."
          : `ליצור קישור חדש ל${member.name}? הקישור הישן שלו/שלה יפסיק לעבוד מיד.`
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(`/api/members/${member.id}/regenerate-token`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) return;
      if (isSelf) {
        onTokenRegenerated(data.token);
      } else {
        setNewLink(`${window.location.origin}/u/${data.token}`);
        onTokenRegenerated(data.token);
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <li className="rounded-lg border-2 border-black p-3 text-sm dark:border-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {member.name}
          {isSelf && " (אני)"}
        </span>
        <input
          type="email"
          className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={saveEmail}
          disabled={savingEmail}
          className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-indigo-50 disabled:opacity-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
        >
          שמור מייל
        </button>
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="rounded-lg border-2 border-orange-600 px-2 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:opacity-50 dark:hover:bg-orange-950"
        >
          קישור חדש
        </button>
      </div>
      {newLink && (
        <div className="mt-2 rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2 dark:border-indigo-700 dark:bg-indigo-950">
          <p>הקישור החדש - שלח/י ל{member.name} (זו הפעם היחידה שהוא מוצג):</p>
          <p className="mt-1 break-all font-mono text-xs">{newLink}</p>
        </div>
      )}
    </li>
  );
}
