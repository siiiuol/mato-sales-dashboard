"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NAV, NAV_ADMIN } from "@/lib/constants";
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items = useMemo(
    () => (role === "admin" ? [...NAV, ...NAV_ADMIN] : [...NAV]),
    [role]
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
          <div className="flex items-center gap-5 shrink-0">
            <Link href="/" className="shell-brand">
              MATO
            </Link>
            <div className="hidden sm:flex flex-col gap-0.5">
              <span className="label">Sales workspace</span>
              <span className="mono text-[0.65rem] text-[var(--text-mute)] tracking-[0.14em]">
                {clock || "--:--:--"} · Vlaanderen
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
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button className="nav-link" type="submit">
                Sign out
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
