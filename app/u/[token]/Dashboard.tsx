"use client";

import { useEffect, useState, useCallback } from "react";
import { REMINDER_PRESETS } from "@/lib/reminders";
import SearchBar from "./SearchBar";
import PushSubscribeButton from "./PushSubscribeButton";

interface MemberSummary {
  id: string;
  name: string;
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
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

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
        <h1 className="text-xl font-semibold">שלום {memberName} 👋</h1>
        <PushSubscribeButton token={token} />
      </header>

      <SearchBar token={token} />

      <section className="flex items-center gap-2">
        <button
          onClick={() => setScope("mine")}
          className={`rounded-full px-3 py-1 text-sm ${scope === "mine" ? "bg-black text-white" : "bg-zinc-100"}`}
        >
          שלי
        </button>
        <button
          onClick={() => setScope("all")}
          className={`rounded-full px-3 py-1 text-sm ${scope === "all" ? "bg-black text-white" : "bg-zinc-100"}`}
        >
          כולם
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowAddEvent((v) => !v)}
          className="rounded bg-black px-3 py-1 text-sm text-white"
        >
          + הוסף מועד
        </button>
      </section>

      {showAddEvent && (
        <AddEventForm
          headers={headers}
          members={members}
          onDone={() => {
            setShowAddEvent(false);
            refresh();
          }}
        />
      )}

      {loading ? (
        <p className="text-center text-zinc-400">טוען...</p>
      ) : visibleEvents.length === 0 ? (
        <p className="text-center text-zinc-400">אין מועדים להצגה</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleEvents.map((event) => (
            <li key={event.id} className="rounded border p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{event.title}</p>
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
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-sm text-red-500"
                  aria-label="מחק מועד"
                >
                  מחק
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">בני המשפחה</h2>
          <button
            onClick={() => setShowAddMember((v) => !v)}
            className="text-sm text-blue-600"
          >
            + הוסף בן משפחה
          </button>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600">
          {members.map((m) => (
            <li key={m.id} className="rounded-full bg-zinc-100 px-3 py-1">
              {m.name}
            </li>
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
      </section>
    </main>
  );
}

function reminderLabel(eventAt: string, remindAt: string): string {
  const diffMinutes = Math.round(
    (new Date(eventAt).getTime() - new Date(remindAt).getTime()) / 60_000
  );
  const preset = REMINDER_PRESETS.find((p) => p.minutes === diffMinutes);
  return preset?.label ?? `${diffMinutes} דקות לפני`;
}

function AddEventForm({
  headers,
  members,
  onDone,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([60 * 24]);
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
      const res = await fetch("/api/events", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          description,
          event_at: new Date(eventAt).toISOString(),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border p-3">
      <input
        className="rounded border px-3 py-2"
        placeholder="כותרת (למשל: תור לרופא שיניים)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="rounded border px-3 py-2"
        placeholder="תיאור (אופציונלי)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="datetime-local"
        className="rounded border px-3 py-2"
        value={eventAt}
        onChange={(e) => setEventAt(e.target.value)}
        required
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
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
                checked={selectedReminders.includes(p.minutes)}
                onChange={() => toggleReminder(p.minutes)}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "שומר..." : "שמור מועד"}
      </button>
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
    <div className="mt-3 flex flex-col gap-2 rounded border p-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="שם בן המשפחה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
          צור קישור אישי
        </button>
      </form>
      {newLink && (
        <div className="rounded bg-green-50 p-2 text-sm">
          <p>שלח/י את הקישור הזה לבן המשפחה - זו הפעם היחידה שהוא מוצג:</p>
          <p className="mt-1 break-all font-mono text-xs">{newLink}</p>
        </div>
      )}
    </div>
  );
}
