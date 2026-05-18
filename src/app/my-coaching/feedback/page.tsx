import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  getMyCoachingFeedback,
  type MyCoachingFeedbackItem,
} from "@/lib/api/my-coaching/feedback";
import { I18nText } from "@/lib/i18n/I18nProvider";

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
      return (
        <I18nText
          k="myCoaching.feedback.status.published"
          fallback="게시됨"
        />
      );
    case "draft":
      return (
        <I18nText k="myCoaching.feedback.status.draft" fallback="임시 저장" />
      );
    case "archived":
      return (
        <I18nText
          k="myCoaching.feedback.status.archived"
          fallback="보관됨"
        />
      );
    default:
      return status;
  }
}

function displayText(value: string | null) {
  return value && value.trim().length > 0 ? (
    value
  ) : (
    <I18nText k="myCoaching.feedback.none" fallback="없음" />
  );
}

function CoachName({ item }: { item: MyCoachingFeedbackItem }) {
  const name = item.coach_display_name ?? item.coach_full_name ?? item.coach_email;

  return name ? (
    <>{name}</>
  ) : (
    <I18nText k="myCoaching.feedback.unknown" fallback="알 수 없음" />
  );
}

function ErrorPage({
  messageFallback,
  messageKey,
  showProfileLink = false,
}: {
  messageFallback: string;
  messageKey: string;
  showProfileLink?: boolean;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="myCoaching.feedback.badge" fallback="내 코칭" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.feedback.title" fallback="받은 피드백" />
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              <I18nText
                k="myCoaching.feedback.backToMyCoaching"
                fallback="내 코칭 공간으로 돌아가기"
              />
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              <I18nText k="myCoaching.feedback.dashboard" fallback="대시보드" />
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <p className="text-slate-700">
            <I18nText k={messageKey} fallback={messageFallback} />
          </p>
          {showProfileLink ? (
            <div className="mt-4">
              <Link className="text-sm font-medium text-slate-700 underline" href="/profile">
                <I18nText
                  k="myCoaching.feedback.viewProfile"
                  fallback="프로필 보기"
                />
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
        messageFallback="아직 프로필이 생성되지 않았습니다."
        messageKey="myCoaching.feedback.noProfile"
        showProfileLink
      />
    );
  }

  if (result.error) {
    return (
      <ErrorPage
        messageFallback="지금 피드백을 불러올 수 없습니다."
        messageKey="myCoaching.feedback.loadFailed"
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
              <I18nText k="myCoaching.feedback.badge" fallback="내 코칭" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.feedback.title" fallback="받은 피드백" />
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="myCoaching.feedback.description"
                fallback="코치가 남긴 주간 기록 피드백을 확인합니다."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              <I18nText
                k="myCoaching.feedback.backToMyCoaching"
                fallback="내 코칭 공간으로 돌아가기"
              />
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              <I18nText k="myCoaching.feedback.dashboard" fallback="대시보드" />
            </Link>
          </div>
        </div>

        {feedbackItems.length === 0 ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">
              <I18nText
                k="myCoaching.feedback.empty"
                fallback="아직 받은 피드백이 없습니다."
              />
            </p>
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
                    <p className="text-sm font-medium text-slate-500">
                      <I18nText k="myCoaching.feedback.coach" fallback="코치" />
                    </p>
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
                      <I18nText
                        k="myCoaching.feedback.weekRange"
                        fallback="주간 기간"
                      />
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatWeekRange(item)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      <I18nText
                        k="myCoaching.feedback.submittedAt"
                        fallback="제출일"
                      />
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.weekly_log_submitted_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      <I18nText
                        k="myCoaching.feedback.createdAt"
                        fallback="작성일"
                      />
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      <I18nText
                        k="myCoaching.feedback.updatedAt"
                        fallback="수정일"
                      />
                    </dt>
                    <dd className="mt-1 text-slate-950">
                      {formatDateTime(item.updated_at)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-4">
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">
                      <I18nText
                        k="myCoaching.feedback.feedback"
                        fallback="피드백"
                      />
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      {displayText(item.feedback_text)}
                    </p>
                  </section>
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">
                      <I18nText
                        k="myCoaching.feedback.encouragement"
                        fallback="격려"
                      />
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      {displayText(item.encouragement)}
                    </p>
                  </section>
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h2 className="font-semibold text-slate-950">
                      <I18nText
                        k="myCoaching.feedback.nextStep"
                        fallback="다음 단계"
                      />
                    </h2>
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
