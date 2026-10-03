"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { sendDirectMail, type DirectMailState } from "@/lib/mail-actions";
import { renderMatoMail } from "@/lib/mail-html";

const EMPTY: DirectMailState = {};

export default function DirectMailComposer({
  senderName,
  ownEmail,
}: {
  senderName: string;
  ownEmail: string;
}) {
  const [state, action, sending] = useActionState(sendDirectMail, EMPTY);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // De voorbeeldweergave loopt een fractie achter op het typen. Zonder die
  // vertraging herlaadt het ingesloten venster bij elke toetsaanslag, en dat
  // flikkert.
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(body), 200);
    return () => clearTimeout(timer);
  }, [body]);

  const preview = useMemo(
    () =>
      renderMatoMail({
        body: settled.trim() ? settled : "Typ hiernaast je bericht.",
        senderName,
      }),
    [settled, senderName]
  );

  // Na een verstuurde mail het formulier leegmaken, zodat een tweede bericht
  // niet per ongeluk de vorige tekst meeneemt.
  const sentTo = state.ok ? state.sentTo : null;
  const [clearedFor, setClearedFor] = useState<string | null>(null);
  if (sentTo && clearedFor !== sentTo) {
    setClearedFor(sentTo);
    setTo("");
    setSubject("");
    setBody("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={action} className="space-y-3">
        <label className="block">
          <span className="label">Aan</span>
          <input
            name="to"
            type="email"
            className="input mt-1"
            placeholder="naam@zaak.be"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
        {ownEmail ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setTo(ownEmail)}
          >
            Naar mezelf, om te zien hoe hij aankomt
          </button>
        ) : null}

        <label className="block">
          <span className="label">Onderwerp</span>
          <input
            name="subject"
            className="input mt-1"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={300}
            required
          />
        </label>

        <label className="block">
          <span className="label">Bericht</span>
          <textarea
            name="body"
            className="textarea mt-1"
            rows={14}
            placeholder={"Dag …\n\nEen lege regel maakt een nieuwe alinea.\nStreepjes maken een lijstje:\n\n- koffie\n- soep"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Je typt gewone tekst. De huisstijl komt er automatisch om, dus je hoeft
          niets op te maken. Webadressen en mailadressen worden zelf aanklikbaar.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Versturen…" : "Versturen"}
          </button>
          {state.error ? (
            <span className="text-xs" style={{ color: "var(--alert)" }}>
              {state.error}
            </span>
          ) : state.ok ? (
            <span className="text-xs" style={{ color: "var(--ok)" }}>
              Verstuurd naar {state.sentTo}.
            </span>
          ) : null}
        </div>
      </form>

      <div className="space-y-2">
        <span className="label">Zo komt hij aan</span>
        <iframe
          title="Voorbeeld van de mail"
          srcDoc={preview}
          className="w-full rounded border"
          style={{ height: "32rem", borderColor: "var(--line)", background: "#faf7f1" }}
          sandbox=""
        />
      </div>
    </div>
  );
}
