import { redirect } from "next/navigation";

/** Bellen zit in Werk; oude links blijven werken. */
export default async function CallsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; queue?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.lead) qs.set("lead", params.lead);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  redirect(`/bellen${suffix}`);
}
