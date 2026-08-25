"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { searchTypeLabel, type SearchHit } from "@/lib/search-types";

/**
 * Globaal zoeken in de header. Ctrl/Cmd+K of klik op Zoeken.
 */
export function GlobalSearch() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setQ("");
    setHits([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (q.trim().length < 2) {
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) {
          setHits([]);
          return;
        }
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [q]);

  const visibleHits = q.trim().length >= 2 ? hits : [];

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <>
      <button type="button" className="nav-link" onClick={open}>
        Zoeken
        <span className="hidden lg:inline mono text-[0.65rem] text-[var(--text-mute)] ml-1">
          ⌘K
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="global-search-dialog"
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="global-search-panel">
          <label className="sr-only" htmlFor={listId}>
            Zoeken in MATO OS
          </label>
          <input
            ref={inputRef}
            id={listId}
            className="input"
            placeholder="Zaak, serienummer, contract, taak…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) =>
                  Math.min(i + 1, Math.max(visibleHits.length - 1, 0))
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && visibleHits[active]) {
                e.preventDefault();
                go(visibleHits[active].href);
              }
            }}
            autoComplete="off"
          />
          <p className="text-xs text-[var(--text-dim)] mt-2 mb-3">
            Leads · klanten · automaten · contracten · taken
            {loading ? " · zoeken…" : null}
          </p>
          {q.trim().length >= 2 && !loading && visibleHits.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] py-4">Niets gevonden.</p>
          ) : null}
          <ul className="global-search-list">
            {visibleHits.map((hit, i) => (
              <li key={`${hit.type}-${hit.id}`}>
                <button
                  type="button"
                  className="global-search-hit"
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit.href)}
                >
                  <span className="badge shrink-0">
                    {searchTypeLabel(hit.type)}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block font-medium truncate">{hit.title}</span>
                    <span className="block text-xs text-[var(--text-dim)] truncate">
                      {hit.subtitle}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--text-mute)] mt-3">
            Of open{" "}
            <Link
              href={q.trim() ? `/zoeken?q=${encodeURIComponent(q.trim())}` : "/zoeken"}
              className="text-[var(--accent)]"
              onClick={close}
            >
              Zoeken
            </Link>{" "}
            voor de volledige lijst.
          </p>
        </div>
      </dialog>
    </>
  );
}
