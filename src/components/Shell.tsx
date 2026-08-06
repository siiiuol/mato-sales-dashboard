"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NAV, NAV_ADMIN } from "@/lib/constants";
import { logout } from "@/lib/auth-actions";

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

  const items = useMemo(
    () => (role === "admin" ? [...NAV, ...NAV_ADMIN] : [...NAV]),
    [role]
  );

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
          {/* Four links fit on a phone, so there is no menu to open. */}
          <nav className="flex flex-wrap items-center justify-end gap-1">
            {items.map((item) => (
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
            <form action={logout}>
              <button className="nav-link" type="submit">
                Exit
              </button>
            </form>
          </nav>
        </div>
      </header>
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
