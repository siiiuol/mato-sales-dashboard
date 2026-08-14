import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { getCurrentUser } from "@/lib/dal";
import { Shell } from "@/components/Shell";
import "./globals.css";

/**
 * The `-src` suffix matters. These variables used to be named `--font-display`
 * and `--font-mono`, the same names globals.css declares on `:root` — and
 * `:root` won, leaving `--font-display: var(--font-display)`, a self-reference
 * that CSS treats as invalid. Both fonts downloaded on every page load and
 * never rendered. Keep these names distinct from the tokens that consume them.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-src",
  weight: ["500", "600", "700"],
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
  display: "swap",
});

// De hoofdlayout: elke sectie erft dit. Sinds er meer dan verkoop in zit, mag
// de titel niet meer één sectie noemen.
export const metadata = {
  title: "MATO OS",
  description: "Verkoop en reclame van MATO, op één plek.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="nl" className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Shell role={user?.role ?? null}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
