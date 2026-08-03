"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { REMINDER_PRESETS } from "@/lib/reminders";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import SearchBar from "./SearchBar";
import PushSubscribeButton from "./PushSubscribeButton";

interface MemberSummary {
  id: string;
  name: string;
  email: string | null;
}

interface EventItem {
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

  const memberName_ = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const visibleEvents = events.filter((e) => {
    if (scope === "all") return true;
    return e.applies_to_all || e.event_members.some((em) => em.member_id === memberId);
  });

  async function deleteEvent(id: string) {
    if (!confirm("למחוק את המועד?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE", headers });
    refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">שלום {memberName} 👋</h1>
        <PushSubscribeButton token={token} />
      </header>

      <SearchBar token={token} />

      <section className="flex items-center gap-2">
        <button
          onClick={() => setScope("mine")}
          className={`rounded-full border-2 border-black px-3 py-1 text-sm font-semibold ${scope === "mine" ? "bg-lime-400 text-black" : "bg-white text-black"}`}
        >
          שלי
        </button>
        <button
          onClick={() => setScope("all")}
          className={`rounded-full border-2 border-black px-3 py-1 text-sm font-semibold ${scope === "all" ? "bg-lime-400 text-black" : "bg-white text-black"}`}
        >
          כולם
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowAddEvent((v) => !v)}
          className="rounded-lg border-2 border-black bg-lime-400 px-3 py-1 text-sm font-semibold text-black transition hover:bg-lime-300"
        >
          + הוסף מועד
        </button>
      </section>

      {showAddEvent && (
        <EventForm
          headers={headers}
          members={members}
          onDone={() => {
            setShowAddEvent(false);
            refresh();
          }}
          onCancel={() => setShowAddEvent(false)}
        />
      )}

      {loading ? (
        <p className="text-center text-zinc-400">טוען...</p>
      ) : visibleEvents.length === 0 ? (
        <p className="text-center text-zinc-400">אין מועדים להצגה</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleEvents.map((event) =>
            editingEventId === event.id ? (
              <li key={event.id}>
                <EventForm
                  headers={headers}
                  members={members}
                  event={event}
                  onDone={() => {
                    setEditingEventId(null);
                    refresh();
                  }}
                  onCancel={() => setEditingEventId(null)}
                />
              </li>
            ) : (
              <li key={event.id} className="rounded-lg border-2 border-black p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-zinc-500">
                      {new Date(event.event_at).toLocaleString("he-IL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jerusalem",
                      })}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-sm text-zinc-600">{event.description}</p>
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
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditingEventId(event.id)}
                      className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-lime-100"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="rounded-lg border-2 border-red-600 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      aria-label="מחק מועד"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <section className="mt-6 border-t-2 border-black pt-4">
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
                className="rounded-lg border-2 border-black px-2 py-1 text-sm font-semibold transition hover:bg-lime-100"
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
  );
}

function diffMinutes(eventAt: string, remindAt: string): number {
  return Math.round((new Date(eventAt).getTime() - new Date(remindAt).getTime()) / 60_000);
}

function reminderLabel(eventAt: string, remindAt: string): string {
  const minutes = diffMinutes(eventAt, remindAt);
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutes);
  return preset?.label ?? `${minutes} דקות לפני`;
}

function toIsraelDateTimeParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

function EventForm({
  headers,
  members,
  event,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  event?: EventItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialDateTime = event ? toIsraelDateTimeParts(event.event_at) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(initialDateTime?.date ?? "");
  const [eventTime, setEventTime] = useState(initialDateTime?.time ?? "");
  const [appliesToAll, setAppliesToAll] = useState(event?.applies_to_all ?? true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    event ? event.event_members.map((em) => em.member_id) : []
  );
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    event ? event.reminders.map((r) => diffMinutes(event.event_at, r.remind_at)) : [60 * 24]
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
          reminder_minutes: selectedReminders,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border-2 border-black p-3">
      <input
        className="rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
        placeholder="כותרת (למשל: תור לרופא שיניים)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
        placeholder="תיאור (אופציונלי)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          type="date"
          className="flex-1 rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
        />
        <input
          type="time"
          className="flex-1 rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-lime-500"
          checked={appliesToAll}
          onChange={(e) => setAppliesToAll(e.target.checked)}
        />
        רלוונטי לכולם
      </label>

      {!appliesToAll && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                className="accent-lime-500"
                checked={selectedMembers.includes(m.id)}
                onChange={() => toggleMember(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-sm text-zinc-500">תזכורות</p>
        <div className="flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((p) => (
            <label key={p.minutes} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                className="accent-lime-500"
                checked={selectedReminders.includes(p.minutes)}
                onChange={() => toggleReminder(p.minutes)}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border-2 border-black bg-lime-400 px-4 py-2 font-semibold text-black transition hover:bg-lime-300 disabled:opacity-50"
        >
          {submitting ? "שומר..." : "שמור מועד"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold transition hover:bg-zinc-100"
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
    <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-black p-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          className="rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          placeholder="שם בן המשפחה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-lg border-2 border-black bg-lime-400 px-3 py-2 text-sm font-semibold text-black transition hover:bg-lime-300"
        >
          צור קישור אישי
        </button>
      </form>
      {newLink && (
        <div className="rounded-lg border-2 border-lime-500 bg-lime-50 p-2 text-sm">
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
    <li className="rounded-lg border-2 border-black p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {member.name}
          {isSelf && " (אני)"}
        </span>
        <input
          type="email"
          className="min-w-0 flex-1 rounded-lg border-2 border-black px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={saveEmail}
          disabled={savingEmail}
          className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-lime-100 disabled:opacity-50"
        >
          שמור מייל
        </button>
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="rounded-lg border-2 border-orange-600 px-2 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:opacity-50"
        >
          קישור חדש
        </button>
      </div>
      {newLink && (
        <div className="mt-2 rounded-lg border-2 border-lime-500 bg-lime-50 p-2">
          <p>הקישור החדש - שלח/י ל{member.name} (זו הפעם היחידה שהוא מוצג):</p>
          <p className="mt-1 break-all font-mono text-xs">{newLink}</p>
        </div>
      )}
    </li>
  );
}
