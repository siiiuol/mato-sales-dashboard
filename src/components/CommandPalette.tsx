"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV } from "@/lib/constants";

type Hit = {
  id: string;
  title: string;
  detail: string;
  href: string;
  group: string;
};

const QUICK_ACTIONS: Hit[] = [
  { id: "act-work", title: "Enter work mode", detail: "review → call → log", href: "/work", group: "Actions" },
  { id: "act-review", title: "Review new leads", detail: "approve or reject the queue", href: "/review", group: "Actions" },
  { id: "act-scan", title: "Scan a zone for leads", detail: "find new prospects", href: "/leads", group: "Actions" },
  { id: "act-quote", title: "Quotes", detail: "build or follow up a quote", href: "/quotes", group: "Actions" },
  { id: "act-doc", title: "Generate a document", detail: "from an approved template", href: "/documents", group: "Actions" },
  { id: "act-creative", title: "Request a creative", detail: "brief the marketing team", href: "/marketing", group: "Actions" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const navHits = useMemo<Hit[]>(
    () =>
      NAV.map((item) => ({
        id: `nav-${item.href}`,
        title: item.label,
        detail: `go to ${item.label.toLowerCase()}`,
        href: item.href,
        group: "Navigate",
      })),
    []
  );

  const staticHits = useMemo(() => {
    const pool = [...QUICK_ACTIONS, ...navHits];
    if (!query.trim()) return pool;
    const q = query.trim().toLowerCase();
    return pool.filter(
      (h) => h.title.toLowerCase().includes(q) || h.detail.toLowerCase().includes(q)
    );
  }, [navHits, query]);

  // Stale hits stay in state while typing; only show them once the query is
  // long enough to have produced them.
  const results = useMemo(
    () => (query.trim().length >= 2 ? [...staticHits, ...hits] : staticHits),
    [staticHits, hits, query]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (event.key === "Escape") {
        close();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mato:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mato:palette", onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    abortRef.current?.abort();
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { hits: Hit[] };
          setHits(data.hits);
        }
      } catch {
        // aborted or offline — keep previous results
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = useCallback(
    (hit: Hit | undefined) => {
      if (!hit) return;
      close();
      router.push(hit.href);
    },
    [close, router]
  );

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(3,5,7,0.72)] backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={close}
    >
      <div
        className="panel w-full max-w-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="input border-0 border-b border-[var(--border)] rounded-none text-base"
          placeholder="Search leads, customers, deals, quotes… or jump anywhere"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((v) => Math.min(v + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(results[active]);
            }
          }}
        />
        <div className="max-h-[52vh] overflow-y-auto p-1">
          {results.length === 0 && (
            <p className="text-sm text-[var(--text-dim)] px-3 py-4">
              {loading ? "Searching…" : "No matches."}
            </p>
          )}
          {results.map((hit, index) => {
            const showGroup = hit.group !== lastGroup;
            lastGroup = hit.group;
            return (
              <div key={hit.id}>
                {showGroup && <p className="label px-3 pt-2 pb-1">{hit.group}</p>}
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 border border-transparent data-[active=true]:border-[var(--accent-dim)] data-[active=true]:bg-[rgba(61,255,154,0.06)] hover:bg-[rgba(61,255,154,0.04)]"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(hit)}
                >
                  <span className="text-sm truncate">{hit.title}</span>
                  <span className="text-xs text-[var(--text-dim)] shrink-0">{hit.detail}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between border-t border-[var(--border)] px-3 py-2 label">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span className="text-[var(--accent)]">{loading ? "searching" : "ready"}</span>
        </div>
      </div>
    </div>
  );
}
