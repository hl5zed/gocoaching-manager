import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getMyProfile } from "@/lib/api/profile/me";
import { updateMyProfile } from "@/lib/api/profile/update-me";
import { ProfileEditView } from "../../../profile/ProfileEditView";

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function CoachEditProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoach%2Fprofile%2Fedit");
  }

  const result = await getMyProfile();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fcoach%2Fprofile%2Fedit");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  async function saveProfile(formData: FormData) {
    "use server";

    const updateResult = await updateMyProfile({
      display_name: formData.get("display_name"),
      phone: formData.get("phone"),
      ministry_position: formData.get("ministry_position"),
      timezone: formData.get("timezone"),
    });

    if (!updateResult.ok) {
      const nextError = encodeURIComponent(updateResult.error.message);
      redirect(`/coach/profile/edit?error=${nextError}`);
    }

    redirect("/coach/profile");
  }

  return (
    <ProfileEditView
      action={saveProfile}
      backHref="/coach/profile"
      cancelHref="/coach/profile"
      errorMessage={errorMessage}
      result={result}
    />
  );
}
