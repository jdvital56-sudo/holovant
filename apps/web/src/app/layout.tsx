import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holovant",
  description: "Holovant — spatial AI operating system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser translators and extensions rewrite attributes on these two tags
    // before React hydrates — Chrome's translator swaps `lang` and adds its own
    // class — which otherwise trips a hydration mismatch on a page we rendered
    // correctly. Suppression applies only to these elements' own attributes.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
