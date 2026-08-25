export type CadenceTask = {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
  cadenceStep: number | null;
};

export function nextCadenceTask(tasks: CadenceTask[]) {
  return [...tasks]
    .filter((task) => task.status === "OPEN")
    .sort(
      (a, b) =>
        (a.cadenceStep ?? Number.MAX_SAFE_INTEGER) -
          (b.cadenceStep ?? Number.MAX_SAFE_INTEGER) ||
        (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
    )[0] ?? null;
}
