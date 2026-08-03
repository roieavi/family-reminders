// Shared JSX for the app icon (browser tab, apple touch icon, manifest icons,
// push notification icon) - rendered via next/og's ImageResponse.
export function BellIcon({ box, glyph }: { box: number; glyph: number }) {
  return (
    <div
      style={{
        width: box,
        height: box,
        background: "#18181b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="white">
        <path d="M8 9a4 4 0 0 1 8 0v3c0 1.6.6 3.1 1.7 4.3.4.4.1 1.2-.5 1.2H6.8c-.6 0-.9-.7-.5-1.2C7.4 15.1 8 13.6 8 12V9z" />
        <rect x="6.5" y="17" width="11" height="1.6" rx="0.8" />
        <circle cx="12" cy="20.3" r="1.4" />
      </svg>
    </div>
  );
}
