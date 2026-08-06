import { redirect } from "next/navigation";

/** Work mode moved to the home page; keep the old address working. */
export default function WorkRedirect() {
  redirect("/");
}
