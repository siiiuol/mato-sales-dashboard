"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NAV, NAV_MORE, NAV_PRIMARY } from "@/lib/constants";
import { logout } from "@/lib/auth-actions";
import { CommandPalette } from "@/components/CommandPalette";

type Role = "admin" | "sales" | "reviewer";

export function Shell({
  children,
  accent = "green",
  role,
}: {
  children: React.ReactNode;
  accent?: string;
  role?: Role | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const primary = useMemo(() => {
    if (role === "admin") return NAV;
    return NAV_PRIMARY;
  }, [role]);

  const more = useMemo(() => {
    if (role === "admin") return [];
    return NAV_MORE;
  }, [role]);

  if (pathname === "/login") {
    return (
      <main data-accent={accent} className="min-h-full">
        {children}
      </main>
    );
  }

  return (
    <div data-accent={accent} className="min-h-full flex flex-col">
      <header className="border-b border-[var(--border)] bg-[rgba(3,5,7,0.88)] backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 shrink-0">
            <Link href="/" className="shell-brand">
              MATO
            </Link>
            <div className="hidden sm:flex flex-col gap-0.5">
              <span className="label anim-scan">Mission control</span>
              <span className="mono text-[0.65rem] text-[var(--text-mute)] tracking-[0.14em]">
                {clock || "--:--:--"} · BE-VLG
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            Menu
          </button>
          <nav className="desktop-nav hidden md:flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              className="nav-link"
              onClick={() => window.dispatchEvent(new Event("mato:palette"))}
              title="Search everything (Ctrl+K)"
            >
              <span className="text-[var(--text-mute)]">⌕</span>
              Ctrl K
            </button>
            {primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={isActive(item.href)}
              >
                <span className="text-[var(--text-mute)]">{item.code}</span>
                {item.label}
              </Link>
            ))}
            {more.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className="nav-link"
                  data-active={more.some((item) => isActive(item.href))}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  <span className="text-[var(--text-mute)]">··</span>
                  More
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-48 panel p-1 z-50">
                    {more.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="nav-link"
                        data-active={isActive(item.href)}
                        onClick={() => setMoreOpen(false)}
                      >
                        <span className="text-[var(--text-mute)]">{item.code}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <form action={logout}>
              <button className="nav-link" type="submit">
                Exit
              </button>
            </form>
          </nav>
        </div>
        {open && (
          <nav className="md:hidden border-t border-[var(--border)] px-2 py-2 grid grid-cols-2 gap-1">
            {[...primary, ...more].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={isActive(item.href)}
                onClick={() => setOpen(false)}
              >
                <span className="text-[var(--text-mute)]">{item.code}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <CommandPalette />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-[var(--border)] py-3 px-4">
        <div className="mx-auto max-w-7xl flex justify-between gap-3 label">
          <span>MATO sales OS · Flanders</span>
          <span className="text-[var(--accent)]">signal active</span>
        </div>
      </footer>
    </div>
  );
}
