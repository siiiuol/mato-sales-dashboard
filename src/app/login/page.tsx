import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 anim-lock">
      <section className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="shell-brand mx-auto">MATO</div>
          <p className="label anim-scan">Mission control access</p>
          <p className="text-sm text-[var(--text-dim)] max-w-sm mx-auto">
            Authenticate to enter the Review → Call → Log work loop.
          </p>
        </div>
        <div className="panel p-6">
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
