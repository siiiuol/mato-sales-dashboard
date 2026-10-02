"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Dunne balk bovenaan zolang de volgende pagina laadt. */
export function NavigationPendingBar() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) {
        return;
      }
      const path = href.split("?")[0];
      if (path === pathname) return;
      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!pending) return null;

  return (
    <div
      className="nav-pending-bar"
      role="progressbar"
      aria-label="Pagina laden"
      aria-busy="true"
    />
  );
}
