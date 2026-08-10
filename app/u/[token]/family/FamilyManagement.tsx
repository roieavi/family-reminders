"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SideMenu from "../SideMenu";
import type { MemberSummary } from "../Dashboard";

export default function FamilyManagement({
  token,
  memberId,
}: {
  token: string;
  memberId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const refresh = useCallback(async () => {
    const res = await fetch("/api/members", { headers });
    const data = await res.json();
    setMembers(data.members ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, [refresh]);

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
            <h1 className="text-2xl font-bold">בני המשפחה</h1>
          </header>

          <div className="mt-4 flex justify-end">
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
                    router.push(`/u/${newToken}/family`);
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
        </main>
      )}
    </SideMenu>
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
