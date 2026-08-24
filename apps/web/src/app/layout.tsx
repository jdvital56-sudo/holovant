import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holovant",
  description: "Holovant — spatial AI operating system",
  other: {
    // Machine translation rewrites text nodes in place, which fights React on
    // a UI whose clock, frame counter and transcript rewrite themselves every
    // second: it corrupts hydration and can crash on the next update. Real
    // localisation is the answer for other languages, not translating a live
    // DOM underneath the app.
    google: "notranslate",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser translators and extensions rewrite attributes on these two tags
    // before React hydrates — Chrome's translator swaps `lang` and adds its own
    // class — which otherwise trips a hydration mismatch on a page we rendered
    // correctly. Suppression applies only to these elements' own attributes.
    <html lang="en" className="h-full" translate="no" suppressHydrationWarning>
      <body className="min-h-full overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
