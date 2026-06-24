import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyCoachingCheckPage() {
  redirect("/my-coaching/moksilgi/monthly");

}
