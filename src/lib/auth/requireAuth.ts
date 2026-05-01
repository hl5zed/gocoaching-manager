import { redirect } from "next/navigation";
import { getSession } from "./getSession";
import type { User } from "@/types/auth";

export async function requireAuth(): Promise<{ user: User }> {
  const result = await getSession();

  if (result.error || !result.user) {
    redirect("/login");
  }

  return { user: result.user };
}
