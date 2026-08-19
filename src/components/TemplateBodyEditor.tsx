"use client";

import { useState } from "react";
import { templateKeys } from "@/lib/documents";

/**
 * Tekstvak voor een sjabloon, met de openstaande `{{plaatshouders}}` eronder.
 *
 * `templateKeys` is puur — geen Prisma, geen server — en kan dus gewoon in de
 * browser meelopen terwijl er getypt wordt, zonder een aparte aanroep.
 */
export function TemplateBodyEditor({ defaultValue }: { defaultValue?: string }) {
  const [body, setBody] = useState(defaultValue ?? "");
  const keys = templateKeys(body);

  return (
    <div className="space-y-1">
      <textarea
        name="body"
        className="textarea mono text-sm"
        rows={16}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={"# TITEL\n\nBeste {{klant_naam}},\n\n..."}
        required
      />
      <p className="text-xs text-[var(--text-dim)]">
        {keys.length > 0 ? (
          <>Plaatshouders: {keys.map((k) => `{{${k}}}`).join(", ")}</>
        ) : (
          "Geen plaatshouders — schrijf {{sleutel}} om er één te gebruiken."
        )}
      </p>
    </div>
  );
}
