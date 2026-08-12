import { redirect } from "next/navigation";

/** Mijn leads staat op de startpagina; oude links blijven werken. */
export default function MyLeadsRedirect() {
  redirect("/");
}
