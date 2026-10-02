/**
 * Direct zichtbaar tijdens navigatie — zonder dit lijkt de app te hangen
 * tot de server klaar is (1–3 s per pagina).
 */
export default function Loading() {
  return (
    <div className="space-y-6 anim-lock" aria-busy="true" aria-label="Pagina laden">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--surface-2)] animate-pulse" />
        <div className="h-8 w-56 max-w-full rounded bg-[var(--surface-2)] animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded bg-[var(--surface-2)] animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel p-4 h-28 animate-pulse" />
        ))}
      </div>
      <div className="panel p-4 h-48 animate-pulse" />
    </div>
  );
}
