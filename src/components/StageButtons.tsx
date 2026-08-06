"use client";

import { useTransition } from "react";
import { updateDealStage } from "@/lib/actions";
import type { DealStage } from "@/lib/types";

const FLOW: DealStage[] = ["QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export function StageButtons({
  dealId,
  stage,
}: {
  dealId: string;
  stage: string;
}) {
  const [pending, start] = useTransition();
  const typedStage = stage as DealStage;
  const idx = FLOW.indexOf(typedStage);

  return (
    <div className="flex flex-wrap gap-1">
      {typedStage !== "WON" &&
        typedStage !== "LOST" &&
        idx >= 0 &&
        idx < FLOW.length - 2 && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => start(() => { void updateDealStage(dealId, FLOW[idx + 1]); })}
          >
            Advance
          </button>
        )}
      {typedStage !== "WON" && typedStage !== "LOST" && (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => start(() => { void updateDealStage(dealId, "WON"); })}
          >
            Mark won
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => start(() => { void updateDealStage(dealId, "LOST"); })}
          >
            Lost
          </button>
        </>
      )}
    </div>
  );
}
