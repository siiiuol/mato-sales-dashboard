"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  APP_MENU_NAV,
  APP_TABS,
  PLATFORM_ADMIN_NAV,
  isTabActive,
} from "@/lib/constants";
import { logout } from "@/lib/auth-actions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NavigationPendingBar } from "@/components/NavigationPendingBar";

type Role = "admin" | "sales" | "reviewer";

export function Shell({
  children,
  role,
  userName,
}: {
  children: React.ReactNode;
  role?: Role | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountLabel = userName?.trim() || "Account";

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  if (pathname === "/login") {
    return <main className="min-h-full">{children}</main>;
  }

  const tabs = (
    <nav className="app-tabs" aria-label="Hoofdmenu">
      {APP_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch
          className="app-tab"
          data-active={isTabActive(tab.href, pathname)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full flex flex-col">
      <NavigationPendingBar />
      <header className="app-header">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="shell-brand">
            MATO
          </Link>
          <div className="hidden sm:block flex-1 min-w-0">{tabs}</div>
          <div className="flex items-center gap-1">
            <GlobalSearch />
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className="nav-link max-w-[9rem] truncate"
                data-active={accountOpen}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((open) => !open)}
              >
                {accountLabel}
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="nav-more-menu anim-panel absolute right-0 z-40 mt-1 min-w-[11rem] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md"
                >
                  {APP_MENU_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className="block px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                      data-active={isTabActive(item.href, pathname)}
                      onClick={() => setAccountOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {role === "admin"
                    ? PLATFORM_ADMIN_NAV.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className="block px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                          data-active={isTabActive(item.href, pathname)}
                          onClick={() => setAccountOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))
                    : null}
                  <form action={logout}>
                    <button
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                      type="submit"
                      role="menuitem"
                    >
                      Afmelden
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="shell-main flex-1 mx-auto w-full min-w-0 max-w-7xl px-4 py-6">
        {children}
      </main>
      <div className="sm:hidden">{tabs}</div>
    </div>
  );
}
