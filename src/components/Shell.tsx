"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isSectionHome,
  PLATFORM_ADMIN_NAV,
  SECTIONS,
  sectionFor,
} from "@/lib/constants";
import { logout } from "@/lib/auth-actions";
import { GlobalSearch } from "@/components/GlobalSearch";

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
  /** Open only while this matches the current path — closes on navigate without an effect. */
  const [moreMenuPath, setMoreMenuPath] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreOpen = moreMenuPath === pathname;

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

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreMenuPath(null);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [moreOpen]);

  const isActive = (href: string) =>
    isSectionHome(href) ? pathname === href : pathname.startsWith(href);

  const section = sectionFor(pathname);
  const moreItems = "more" in section ? [...section.more] : [];

  const items = useMemo(() => {
    const current = sectionFor(pathname);
    return role === "admin"
      ? [...current.nav, ...PLATFORM_ADMIN_NAV]
      : [...current.nav];
  }, [role, pathname]);

  const moreActive = moreItems.some((item) => isActive(item.href));

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
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" className="shell-brand">
              MATO
            </Link>
            <div className="section-switcher flex items-center gap-0.5 sm:gap-1">
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
          <nav className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:justify-end">
            <GlobalSearch />
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link nav-indicator"
                data-active={isActive(item.href)}
              >
                {item.label}
              </Link>
            ))}
            {moreItems.length > 0 ? (
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  className="nav-link"
                  data-active={moreActive || moreOpen}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  onClick={() =>
                    setMoreMenuPath(moreOpen ? null : pathname)
                  }
                >
                  Meer
                </button>
                {moreOpen ? (
                  <div
                    role="menu"
                    className="nav-more-menu anim-panel absolute right-0 z-40 mt-1 min-w-[11rem] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md"
                  >
                    {moreItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className="block px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                        data-active={isActive(item.href)}
                        onClick={() => setMoreMenuPath(null)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <Link
              href="/handleiding"
              className="nav-link"
              data-active={pathname.startsWith("/handleiding")}
              title="Handleiding"
              aria-label="Handleiding"
            >
              ?
            </Link>
            <form action={logout}>
              <button className="nav-link" type="submit">
                Afmelden
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full min-w-0 max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-[var(--border)] py-3 px-4">
        <div className="mx-auto max-w-7xl flex justify-between gap-3 label">
          <span>MATO · Vlaanderen</span>
        </div>
      </footer>
    </div>
  );
}
