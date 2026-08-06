"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import SetupForm from "./SetupForm";
import JoinForm from "./JoinForm";

// How long the logo sits alone before we either redirect a returning member
// or reveal the join/setup form - keeps the launch feeling branded instead
// of the form flashing in instantly.
const BRAND_MS = 1200;

export default function EntryScreen({
  familyExists,
}: {
  familyExists: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(MEMBER_TOKEN_KEY));
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    const timer = setTimeout(() => {
      if (token) {
        router.replace(`/u/${token}`);
      } else {
        setShowForm(true);
      }
    }, BRAND_MS);
    return () => clearTimeout(timer);
  }, [token, router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-full-white.png" alt="תזכיר לי" className="w-48 shrink-0" />
      {showForm && (
        <div className="w-full max-w-sm animate-fade-in rounded-2xl border-2 border-black bg-white p-6">
          {familyExists ? <JoinForm /> : <SetupForm />}
        </div>
      )}
    </div>
  );
}
