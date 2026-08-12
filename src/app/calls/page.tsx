import { redirect } from "next/navigation";

/** Bellen zit in Werk; oude links blijven werken. */
export default async function CallsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; queue?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.lead) qs.set("focus", params.lead);
  if (params.queue === "1") qs.set("queue", "1");
  const suffix = qs.size ? `?${qs.toString()}` : "";
  redirect(`/${suffix}`);
}
