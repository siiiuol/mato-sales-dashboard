"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  isSectionHome,
  PLATFORM_ADMIN_NAV,
  SECTIONS,
  sectionFor,
} from "@/lib/constants";
import { logout } from "@/lib/auth-actions";

type Role = "admin" | "sales" | "reviewer";

export function Shell({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: Role | null;
}) {
  const pathname = usePathname();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("nl-BE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // De voorpagina van een sectie moet exact matchen, de rest op het begin van
  // het pad. Anders blijft "Campagnes" branden op /reclame/materiaal.
  const isActive = (href: string) =>
    isSectionHome(href) ? pathname === href : pathname.startsWith(href);

  const section = sectionFor(pathname);

  const items = useMemo(
    () =>
      role === "admin"
        ? [...section.nav, ...PLATFORM_ADMIN_NAV]
        : [...section.nav],
    [role, section]
  );

  if (pathname === "/login") {
    return (
      <main className="min-h-full">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="app-header">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            {/* Blijft naar de voorpagina wijzen: de uitweg uit een sectie. */}
            <Link href="/" className="shell-brand">
              MATO
            </Link>
            {/* Bewust buiten het `hidden sm:flex`-blok hieronder: stond de
                schakelaar daarin, dan kon je op een telefoon niet van sectie
                wisselen. De klok mag wél wegvallen. */}
            <div className="flex items-center gap-1">
              {SECTIONS.map((s) => (
                <Link
                  key={s.key}
                  href={s.home}
                  className="nav-link"
                  data-active={s.key === section.key}
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <div className="hidden sm:flex flex-col gap-0.5">
              <span className="mono text-[0.65rem] text-[var(--text-mute)] tracking-[0.14em]">
                {clock || "--:--:--"} · Vlaanderen
              </span>
            </div>
          </div>
          {/* Op een smal scherm valt de balk netjes op een tweede regel; het
              blok is flex-wrap. Geen uitklapmenu nodig. */}
          <nav className="flex flex-wrap items-center justify-end gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={isActive(item.href)}
              >
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button className="nav-link" type="submit">
                Afmelden
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-[var(--border)] py-3 px-4">
        <div className="mx-auto max-w-7xl flex justify-between gap-3 label">
          <span>MATO · Vlaanderen</span>
        </div>
      </footer>
    </div>
  );
}
