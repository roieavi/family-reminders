"use client";

import { useState } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import { colorForMember } from "@/lib/memberColors";
import { formatCountdown } from "@/lib/countdown";
import { EventForm, type EventItem, type MemberSummary } from "./Dashboard";

export default function GridView({
  events,
  members,
  headers,
  onRefresh,
  onDelete,
}: {
  events: EventItem[];
  members: MemberSummary[];
  headers: Record<string, string>;
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingEvent = events.find((e) => e.id === editingId) ?? null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {events.map((event) => {
        const countdown = formatCountdown(event.event_at);
        const relevantMembers = event.applies_to_all
          ? members
          : members.filter((m) => event.event_members.some((em) => em.member_id === m.id));
        const cardColor = !event.applies_to_all
          ? colorForMember(members, relevantMembers[0]?.id ?? "").light
          : "bg-zinc-100";

        return (
          <div
            key={event.id}
            onClick={() => setEditingId(event.id)}
            className={`flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ${cardColor}`}
          >
            <div className="flex items-start justify-between gap-1">
              <CountdownBadge countdown={countdown} size="sm" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event.id);
                }}
                aria-label="מחק מועד"
                className="text-xs text-zinc-400 transition hover:text-red-600"
              >
                ✕
              </button>
            </div>
            <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{event.title}</p>
            <p className="text-xs text-zinc-600">
              {new Date(event.event_at).toLocaleString("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Jerusalem",
              })}
            </p>
            <div className="mt-1 flex -space-x-2">
              {relevantMembers.slice(0, 3).map((m) => (
                <Avatar key={m.id} name={m.name} color={colorForMember(members, m.id)} size="sm" ring />
              ))}
              {relevantMembers.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-zinc-900 ring-2 ring-white">
                  +{relevantMembers.length - 3}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {editingEvent && (
        <Modal onClose={() => setEditingId(null)} title="עריכת מועד">
          <EventForm
            headers={headers}
            members={members}
            event={editingEvent}
            onDone={() => {
              setEditingId(null);
              onRefresh();
            }}
            onCancel={() => setEditingId(null)}
          />
        </Modal>
      )}
    </div>
  );
}
