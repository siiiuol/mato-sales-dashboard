import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { EmployeeForm } from "@/components/EmployeeForm";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requirePageUser(["admin"]);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Team</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Medewerker toevoegen
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Het wachtwoord wordt aangemaakt en één keer getoond.
          </p>
        </div>
        <Link href="/team" className="btn">
          Terug naar Team
        </Link>
      </div>

      <EmployeeForm />
    </div>
  );
}
