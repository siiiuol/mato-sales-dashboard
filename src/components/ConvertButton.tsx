"use client";

import { useTransition } from "react";

export function ConvertButton({
  leadId,
  action,
}: {
  leadId: string;
  action: (id: string) => Promise<string>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={pending}
      onClick={() =>
        start(() => {
          void action(leadId);
        })
      }
    >
      {pending ? "…" : "Convert"}
    </button>
  );
}
