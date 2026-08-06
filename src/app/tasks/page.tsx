import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createTask, setTaskStatus } from "@/lib/task-actions";
import {
  TASK_ACTIVE_STATUSES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type Scope = "mine" | "team";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const sp = await searchParams;
  const scope: Scope = sp.scope === "team" ? "team" : "mine";
  const statusFilter =
    sp.status && TASK_STATUSES.includes(sp.status as (typeof TASK_STATUSES)[number])
      ? sp.status
      : null;

  const where = {
    ...(scope === "mine" ? { assignedToId: user.id } : {}),
    ...(statusFilter
      ? { status: statusFilter }
      : { status: { in: [...TASK_ACTIVE_STATUSES] } }),
  };

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(endOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [tasks, users, recentlyDone, leads, customers] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.count({
      where: {
        status: "DONE",
        completedAt: { gte: weekAgo },
        ...(scope === "mine" ? { assignedToId: user.id } : {}),
      },
    }),
    prisma.lead.findMany({
      where: { status: { notIn: ["LOST", "DO_NOT_CONTACT"] } },
      orderBy: { score: "desc" },
      take: 50,
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const groups: { key: string; label: string; tone?: string; items: typeof tasks }[] = [
    {
      key: "overdue",
      label: "Overdue",
      tone: "text-[var(--warn)]",
      items: tasks.filter((t) => t.dueAt && t.dueAt < now),
    },
    {
      key: "today",
      label: "Due today",
      items: tasks.filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= endOfToday),
    },
    {
      key: "week",
      label: "Next 7 days",
      items: tasks.filter((t) => t.dueAt && t.dueAt > endOfToday && t.dueAt <= endOfWeek),
    },
    {
      key: "later",
      label: "Later",
      items: tasks.filter((t) => t.dueAt && t.dueAt > endOfWeek),
    },
    {
      key: "undated",
      label: "No due date",
      items: tasks.filter((t) => !t.dueAt),
    },
  ];

  const overdueCount = groups[0].items.length;

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Channel 13</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Tasks</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Everything you promised · nothing falls through
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/tasks?scope=mine"
            className="nav-link"
            data-active={scope === "mine"}
          >
            My tasks
          </Link>
          <Link
            href="/tasks?scope=team"
            className="nav-link"
            data-active={scope === "team"}
          >
            Team
          </Link>
        </div>
      </div>

      <div className="mission-strip">
        <span>
          Open <strong>{tasks.length}</strong>
        </span>
        <span className={overdueCount > 0 ? "text-[var(--warn)]" : undefined}>
          Overdue <strong>{overdueCount}</strong>
        </span>
        <span>
          Done last 7 days <strong>{recentlyDone}</strong>
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <Link href={`/tasks?scope=${scope}`} className="badge" data-active={!statusFilter}>
            all active
          </Link>
          {TASK_ACTIVE_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/tasks?scope=${scope}&status=${s}`}
              className={`badge ${statusFilter === s ? "badge-live" : ""}`}
            >
              {TASK_STATUS_LABELS[s]}
            </Link>
          ))}
          <Link
            href={`/tasks?scope=${scope}&status=DONE`}
            className={`badge ${statusFilter === "DONE" ? "badge-live" : ""}`}
          >
            completed
          </Link>
        </span>
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">+ New task</summary>
        <form action={createTask} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="label">Task *</span>
            <input className="input" name="title" required maxLength={300} placeholder="Call back about the frozen unit" />
          </label>
          <label className="space-y-1">
            <span className="label">Due</span>
            <input className="input" name="dueAt" type="datetime-local" />
          </label>
          <label className="space-y-1">
            <span className="label">Assign to</span>
            <select className="select" name="assignedToId" defaultValue={user.id}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Priority (0–100)</span>
            <input className="input" name="priority" type="number" min={0} max={100} defaultValue={50} />
          </label>
          <label className="space-y-1">
            <span className="label">Link to lead</span>
            <select className="select" name="leadId" defaultValue="">
              <option value="">—</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Link to customer</span>
            <select className="select" name="customerId" defaultValue="">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="label">Notes</span>
            <textarea className="textarea" name="description" maxLength={2000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary" type="submit">Create task</button>
          </div>
        </form>
      </details>

      {tasks.length === 0 ? (
        <section className="panel p-6 text-[var(--text-dim)]">
          {statusFilter
            ? `No tasks with status “${TASK_STATUS_LABELS[statusFilter]}”.`
            : scope === "mine"
              ? "Your task list is clear. Nothing is waiting on you."
              : "No open tasks across the team."}
        </section>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <section key={group.key} className="panel p-4 space-y-3">
              <h2 className={`label ${group.tone ?? "text-[var(--accent)]"}`}>
                {group.label} · {group.items.length}
              </h2>
              <ul className="space-y-3">
                {group.items.map((task) => {
                  const overdue = task.dueAt && task.dueAt < now && task.status !== "DONE";
                  return (
                    <li key={task.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <p className="text-sm text-[var(--text-dim)] mt-1 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--text-dim)]">
                            <span className={`mono ${overdue ? "text-[var(--warn)]" : ""}`}>
                              {task.dueAt
                                ? task.dueAt.toLocaleString("nl-BE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "no due date"}
                            </span>
                            <span className="badge">{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
                            {task.assignedTo && scope === "team" && (
                              <span className="badge">{task.assignedTo.name}</span>
                            )}
                            {task.lead && (
                              <Link href={`/leads/${task.lead.id}`} className="text-[var(--accent)]">
                                {task.lead.name}
                              </Link>
                            )}
                            {task.customer && (
                              <Link href="/customers" className="text-[var(--accent)]">
                                {task.customer.name}
                              </Link>
                            )}
                            {task.deal && (
                              <Link href="/deals" className="text-[var(--accent)]">
                                {task.deal.title}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <form action={setTaskStatus} className="flex items-center gap-2">
                            <input type="hidden" name="taskId" value={task.id} />
                            <select
                              className="select w-auto min-h-0 py-1 text-xs"
                              name="status"
                              defaultValue={task.status}
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                            <button className="btn py-1 min-h-0" type="submit">Set</button>
                          </form>
                          {task.status !== "DONE" && (
                            <form action={setTaskStatus}>
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="status" value="DONE" />
                              <button className="btn btn-primary py-1 min-h-0" type="submit">
                                Done
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
