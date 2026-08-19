/**
 * De rekenkant van "wat moet er vandaag gebeuren".
 *
 * Bewust zonder database-afhankelijkheid, zelfde reden als `team-stats.ts`:
 * dit is logica die met een test vastligt, geen server nodig. De queries
 * staan in de pagina's zelf (`/taken`, en straks de stroken op Werk en
 * Klanten), zodat ze allemaal dezelfde grens gebruiken zonder dat dit
 * bestand onbedoeld ontestbaar wordt door een Prisma- of "server-only"-import.
 */

export type DueTask = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  priority: number;
  lead: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
};

export type TaskGroups<T> = {
  overdue: T[];
  today: T[];
  later: T[];
};

/**
 * Verdeelt taken over Achterstallig / Vandaag / Later.
 *
 * Puur en apart van de query, zodat de grens tussen "vandaag" en "later" met
 * een test vastligt in plaats van ergens stilzwijgend in een component.
 */
export function groupTasksByDueDate<T extends { dueAt: Date | null }>(
  tasks: T[],
  now: Date = new Date()
): TaskGroups<T> {
  // UTC, bewust: `setHours` loopt op de tijdzone van het proces dat toevallig
  // draait, en Vercel-functies draaien niet gegarandeerd in dezelfde zone als
  // Vlaanderen. Een vaste grens is beter dan een die verschuift naargelang
  // waar de server toevallig staat.
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

  const groups: TaskGroups<T> = { overdue: [], today: [], later: [] };
  for (const task of tasks) {
    if (!task.dueAt) {
      groups.later.push(task);
    } else if (task.dueAt.getTime() < startOfToday.getTime()) {
      groups.overdue.push(task);
    } else if (task.dueAt.getTime() < startOfTomorrow.getTime()) {
      groups.today.push(task);
    } else {
      groups.later.push(task);
    }
  }
  return groups;
}

/** De query die elke plek die taken toont hoort te gebruiken — zie de pagina's voor de aanroep. */
export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  priority: true,
  lead: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} as const;
