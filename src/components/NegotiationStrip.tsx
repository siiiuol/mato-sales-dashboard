const STEPS = [
  { key: "proposal", label: "Voorstel", href: "#voorstel" },
  { key: "deal", label: "Deal", href: "#deal" },
  { key: "document", label: "Document", href: "#documenten" },
  { key: "mail", label: "Mail", href: "#mail" },
] as const;

export function NegotiationStrip({
  completed,
}: {
  completed: {
    proposal: boolean;
    deal: boolean;
    document: boolean;
    mail: boolean;
  };
}) {
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label text-[var(--accent)] mr-2">
          Voorstel → close
        </span>
        {STEPS.map((step, index) => (
          <span key={step.key} className="contents">
            {index > 0 ? (
              <span className="text-[var(--text-mute)]">→</span>
            ) : null}
            <a
              href={step.href}
              className={`badge ${completed[step.key] ? "badge-live" : ""}`}
            >
              {completed[step.key] ? "✓ " : ""}
              {step.label}
            </a>
          </span>
        ))}
      </div>
    </section>
  );
}
