import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .neq("status", "anonymized")
    .is("deleted_at", null);

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  const profileRecord = profile as { id: string };
  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("profile_id", profileRecord.id)
    .eq("role", "super_admin")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  if (roleError || !role) {
    redirect("/dashboard");
  }

  return {
    user: session.user,
    profile: profileRecord,
    role,
  };
}
