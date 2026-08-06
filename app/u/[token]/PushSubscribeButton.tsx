"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton({ token }: { token: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      setSupported(isSupported);
      if (!isSupported) return;
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    }
    checkStatus();
  }, []);

  async function subscribe() {
    if (subscribed) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-member-token": token },
        body: JSON.stringify({ subscription }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      onClick={subscribe}
      disabled={busy || subscribed}
      aria-label={subscribed ? "התראות פעילות" : "הפעל התראות"}
      aria-pressed={subscribed}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
        subscribed ? "bg-white text-indigo-600" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 9a4 4 0 0 1 8 0v3c0 1.6.6 3.1 1.7 4.3.4.4.1 1.2-.5 1.2H6.8c-.6 0-.9-.7-.5-1.2C7.4 15.1 8 13.6 8 12V9z" />
        <rect x="6.5" y="17" width="11" height="1.6" rx="0.8" />
        <circle cx="12" cy="20.3" r="1.4" />
      </svg>
    </button>
  );
}
