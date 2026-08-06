import { IBM_Plex_Mono, Outfit, Space_Grotesk } from "next/font/google";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { Shell } from "@/components/Shell";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "MATO — Mission Control",
  description: "Flanders B2B lead intelligence and sales operating system",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let accent = "green";
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
    if (settings?.accent) accent = settings.accent;
  } catch {
    // DB may not be ready on first boot
  }

  const user = await getCurrentUser();

  return (
    <html lang="nl" className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Shell accent={accent} role={user?.role ?? null}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
