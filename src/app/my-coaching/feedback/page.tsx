import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getMyCoachingFeedback,
  type MyCoachingFeedbackItem,
} from "@/lib/api/my-coaching/feedback";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWeekRange(item: MyCoachingFeedbackItem) {
  if (!item.week_start || !item.week_end) {
    return "-";
  }

  return `${item.week_start} ~ ${item.week_end}`;
}

function getFeedbackStatusLabel(status: string) {
  switch (status) {
    case "published":
      return "게시됨";
    case "draft":
      return "임시 저장";
    case "archived":
      return "보관됨";
    default:
      return status;
  }
}

function displayText(value: string | null) {
  return value && value.trim().length > 0 ? value : "없음";
}

function CoachName({ item }: { item: MyCoachingFeedbackItem }) {
  return (
    <>
      {item.coach_display_name ??
        item.coach_full_name ??
        item.coach_email ??
        "알 수 없음"}
    </>
  );
}

function ErrorPage({
  title,
  message,
  showProfileLink = false,
}: {
  title: string;
  message: string;
  showProfileLink?: boolean;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              내 코칭
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <p className="text-slate-700">{message}</p>
          {showProfileLink ? (
            <div className="mt-4">
              <Link className="text-sm font-medium text-slate-700 underline" href="/profile">
                프로필 보기
              </Link>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default async function MyCoachingFeedbackPage() {
  const result = await getMyCoachingFeedback();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Ffeedback");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return (
      <ErrorPage
        message="아직 프로필이 생성되지 않았습니다."
        showProfileLink
        title="받은 피드백"
      />
    );
  }

  if (result.error) {
    return (
      <ErrorPage
        message="지금 피드백을 불러올 수 없습니다."
        title="받은 피드백"
      />
    );
  }

  const feedbackItems = result.data;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              내 코칭
            </p>
            <h1 className="mt-3 text-3xl font-semibold">받은 피드백</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              코치가 남긴 주간 기록 피드백을 확인합니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        {feedbackItems.length === 0 ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">아직 받은 피드백이 없습니다.</p>
          </section>
        ) : (
          <section className="mt-8 grid gap-5">
            {feedbackItems.map((item) => (
              <article
                className="rounded-md border border-slate-200 bg-white p-6"
                key={item.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">코치</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      <CoachName item={item} />
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.coach_email ?? "-"}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {getFeedbackStatusLabel(item.status)}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      주간 기간
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatWeekRange(item)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      제출일
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.weekly_log_submitted_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      작성일
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      수정일
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.updated_at)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-4">
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">피드백</h2>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      {displayText(item.feedback_text)}
                    </p>
                  </section>
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">격려</h2>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      {displayText(item.encouragement)}
                    </p>
                  </section>
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">다음 단계</h2>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      {displayText(item.next_step)}
                    </p>
                  </section>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
