"use client";

import { useTransition } from "react";

/**
 * Contact / Skip / Unskip for one lead.
 *
 * Which buttons show depends on where the lead sits in triage: undecided leads
 * can be taken or skipped, skipped ones can be brought back, and a lead already
 * on the call list only needs a way off it.
 */
export function TriageButtons({
  leadId,
  status,
  complianceStatus,
  contactAction,
  skipAction,
  unskipAction,
  compact = false,
}: {
  leadId: string;
  status: string;
  complianceStatus: string;
  contactAction: (id: string) => Promise<void>;
  skipAction: (id: string) => Promise<void>;
  unskipAction: (id: string) => Promise<void>;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const size = compact ? "btn btn-sm" : "btn";

  const run = (fn: (id: string) => Promise<void>) => () => {
    start(async () => {
      await fn(leadId);
    });
  };

  if (status === "SKIPPED") {
    return (
      <button
        type="button"
        className={size}
        disabled={pending}
        onClick={run(unskipAction)}
      >
        Terugzetten
      </button>
    );
  }

  const undecided = complianceStatus === "PENDING" && status === "NEW";

  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {undecided && (
        <button
          type="button"
          className={`${size} btn-primary`}
          disabled={pending}
          onClick={run(contactAction)}
        >
          Bellen
        </button>
      )}
      <button
        type="button"
        className={`${size} btn-ghost`}
        disabled={pending}
        onClick={run(skipAction)}
      >
        Overslaan
      </button>
    </div>
  );
}
