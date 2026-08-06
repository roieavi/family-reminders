import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Heebo } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "תזכיר לי",
  description: "מישהו צריך לזכור את זה",
};

// Tells mobile browsers (notably Android Chrome's forced/auto-dark web
// content darkening) that this page handles its own light/dark theming, so
// they don't algorithmically re-darken it on top of our own light choice.
export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </body>
    </html>
  );
}
