"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  postLeadComment,
  type LeadCommentState,
} from "@/lib/lead-comment-actions";

const EMPTY: LeadCommentState = {};

export type LeadChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

/**
 * Interne teamchat op de leadfiche — bubbels, geen statuswijziging.
 */
export function LeadChatPanel({
  leadId,
  currentUserId,
  canPost,
  messages,
}: {
  leadId: string;
  currentUserId: string;
  canPost: boolean;
  messages: LeadChatMessage[];
}) {
  const [state, action, pending] = useActionState(postLeadComment, EMPTY);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, state.savedId]);

  return (
    <section className="panel p-4 space-y-3 anim-panel">
      <div>
        <h2 className="label text-[var(--accent)]">Teamchat</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Intern overleg over deze zaak. Klantcontact noteert u apart hierboven.
        </p>
      </div>

      <div className="chat-thread max-h-72 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Nog geen berichten. Zet hier wat een collega moet weten.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.author.id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`chat-bubble anim-bubble ${mine ? "chat-bubble-mine" : "chat-bubble-theirs"}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium">
                    {mine ? "U" : msg.author.name}
                  </span>
                  <span className="mono text-[0.65rem] text-[var(--text-mute)]">
                    {new Date(msg.createdAt).toLocaleString("nl-BE", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                  {msg.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <Composer
          key={state.savedId ?? "leeg"}
          leadId={leadId}
          state={state}
          action={action}
          pending={pending}
        />
      ) : (
        <p className="text-xs text-[var(--text-dim)]">
          Alleen lezen — meelezers plaatsen geen berichten.
        </p>
      )}
    </section>
  );
}

function Composer({
  leadId,
  state,
  action,
  pending,
}: {
  leadId: string;
  state: LeadCommentState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block">
        <span className="sr-only">Bericht</span>
        <textarea
          name="body"
          className="textarea"
          rows={2}
          required
          maxLength={4000}
          placeholder="Bericht aan het team…"
        />
      </label>
      {state.error ? (
        <p className="text-sm" style={{ color: "var(--alert)" }} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-press" disabled={pending}>
        {pending ? "Bezig…" : "Versturen"}
      </button>
    </form>
  );
}
