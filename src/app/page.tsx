import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  if (session.user) {
    redirect("/dashboard");
  }

  redirect("/login");
}
