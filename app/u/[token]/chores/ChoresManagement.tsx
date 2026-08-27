"use client";

import { useCallback, useEffect, useState } from "react";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import SideMenu from "../SideMenu";
import Modal from "../Modal";
import ToggleSwitch from "../ToggleSwitch";
import type { MemberSummary } from "../Dashboard";

interface ChoreItem {
  id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  scheduled_time: string | null;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}

interface StickyNoteItem {
  id: string;
  text: string;
  member_id: string;
  created_at: string;
}

export default function ChoresManagement({ token }: { token: string }) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [showAddChore, setShowAddChore] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const refresh = useCallback(async () => {
    setLoading(true);
    const [membersRes, choresRes, notesRes] = await Promise.all([
      fetch("/api/members", { headers }),
      fetch("/api/chores", { headers }),
      fetch("/api/sticky-notes", { headers }),
    ]);
    const membersData = await membersRes.json();
    const choresData = await choresRes.json();
    const notesData = await notesRes.json();
    setMembers(membersData.members ?? []);
    setChores(choresData.chores ?? []);
    setNotes(notesData.notes ?? []);
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

  async function deleteChore(id: string) {
    if (!confirm("למחוק את המשימה?")) return;
    await fetch(`/api/chores/${id}`, { method: "DELETE", headers });
    refresh();
  }

  async function deleteNote(id: string) {
    await fetch(`/api/sticky-notes/${id}`, { method: "DELETE", headers });
    refresh();
  }

  const dailyChores = chores.filter((c) => c.recurrence === "daily");
  const onceChores = chores.filter((c) => c.recurrence === "once");

  return (
    <SideMenu token={token}>
      {({ open }) => (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
          <header className="flex items-center gap-3">
            <button
              type="button"
              onClick={open}
              aria-label="פתח תפריט"
              className="flex h-8 w-8 items-center justify-center"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">לו״ז יומי</h1>
          </header>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">תורנויות ומשימות</h2>
              <button
                onClick={() => setShowAddChore(true)}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + הוסף משימה
              </button>
            </div>

            {loading ? (
              <p className="mt-3 text-center text-zinc-400">טוען...</p>
            ) : (
              <>
                <ChoreGroup
                  title="יומיומיות"
                  chores={dailyChores}
                  members={members}
                  onEdit={setEditingChoreId}
                  onDelete={deleteChore}
                />
                <ChoreGroup
                  title="חד-פעמיות"
                  chores={onceChores}
                  members={members}
                  onEdit={setEditingChoreId}
                  onDelete={deleteChore}
                />
              </>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">פתקים להיום</h2>
            <NoteForm headers={headers} onDone={refresh} />
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <span>{note.text}</span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="shrink-0 text-xs font-semibold text-red-500 transition hover:text-red-700"
                  >
                    מחק
                  </button>
                </li>
              ))}
              {notes.length === 0 && <p className="text-sm text-zinc-400">אין פתקים היום</p>}
            </ul>
          </section>

          {showAddChore && (
            <Modal onClose={() => setShowAddChore(false)} title="הוספת משימה">
              <ChoreForm
                headers={headers}
                members={members}
                onDone={() => {
                  setShowAddChore(false);
                  refresh();
                }}
                onCancel={() => setShowAddChore(false)}
              />
            </Modal>
          )}

          {editingChoreId &&
            (() => {
              const editingChore = chores.find((c) => c.id === editingChoreId);
              if (!editingChore) return null;
              return (
                <Modal onClose={() => setEditingChoreId(null)} title="עריכת משימה">
                  <ChoreForm
                    headers={headers}
                    members={members}
                    chore={editingChore}
                    onDone={() => {
                      setEditingChoreId(null);
                      refresh();
                    }}
                    onCancel={() => setEditingChoreId(null)}
                  />
                </Modal>
              );
            })()}
        </main>
      )}
    </SideMenu>
  );
}

function ChoreGroup({
  title,
  chores,
  members,
  onEdit,
  onDelete,
}: {
  title: string;
  chores: ChoreItem[];
  members: MemberSummary[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-zinc-400">{title}</p>
      {chores.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-400">אין משימות</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-2">
          {chores.map((chore) => (
            <li
              key={chore.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div>
                <p className="font-semibold">{chore.title}</p>
                <p className="text-xs text-zinc-400">
                  {chore.chore_members
                    .map((cm) => members.find((m) => m.id === cm.member_id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => onEdit(chore.id)}
                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
                >
                  ערוך
                </button>
                <button
                  onClick={() => onDelete(chore.id)}
                  className="text-xs font-semibold text-red-500 transition hover:text-red-700"
                >
                  מחק
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChoreForm({
  headers,
  members,
  chore,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  chore?: ChoreItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(chore?.title ?? "");
  const [recurrence, setRecurrence] = useState<"daily" | "once">(chore?.recurrence ?? "daily");
  const [onceDate, setOnceDate] = useState(chore?.once_date ?? "");
  const [scheduledTime, setScheduledTime] = useState(chore?.scheduled_time?.slice(0, 5) ?? "");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    chore ? chore.chore_members.map((cm) => cm.member_id) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = JSON.stringify({
        title,
        recurrence,
        once_date: recurrence === "once" ? onceDate : null,
        scheduled_time: scheduledTime || null,
        member_ids: selectedMembers,
      });
      const res = await fetch(chore ? `/api/chores/${chore.id}` : "/api/chores", {
        method: chore ? "PATCH" : "POST",
        headers,
        body,
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
          placeholder="למשל: הורדת זבל"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>שעת ביצוע (אופציונלי)</span>
        <input
          type="time"
          className={fieldInput}
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
        />
      </label>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>חזרתיות</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">יומיומית</span>
            <ToggleSwitch
              checked={recurrence === "once"}
              onChange={(checked) => setRecurrence(checked ? "once" : "daily")}
            />
            <span className="text-sm">חד-פעמית</span>
          </div>
          {recurrence === "once" && (
            <div className="border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700">
              <input
                type="date"
                className={fieldInput}
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                required
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>שיוך</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 first:border-t-0 dark:border-zinc-700"
            >
              <span className="text-sm">{m.name}</span>
              <ToggleSwitch checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundImage: "linear-gradient(to left, #4f46e5, #7c3aed)" }}
        >
          {submitting ? "שומר..." : "שמור משימה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full py-1 text-sm font-semibold text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

function NoteForm({ headers, onDone }: { headers: Record<string, string>; onDone: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/sticky-notes", {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      setText("");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
        placeholder="פתק חדש..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        הוסף
      </button>
    </form>
  );
}
