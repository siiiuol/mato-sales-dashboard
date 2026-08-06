import { ReviewBoard } from "@/components/ReviewBoard";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 03</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Review</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Bakeries &amp; local food · grouped by category · sorted by score · click for company info
        </p>
      </div>
      <ReviewBoard initialLeads={[]} />
    </div>
  );
}
