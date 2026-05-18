import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { getSession } from "@/lib/auth/getSession";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";
import type {
  CoachingRelationshipStatus,
  RelationshipType,
  ScopeType,
} from "@/types/database";

export const dynamic = "force-dynamic";

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function formatDate(value: string | null) {
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
  }).format(date);
}

function relationshipStatusBadgeClass(status: CoachingRelationshipStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ended":
      return "border-slate-300 bg-slate-50 text-slate-700";
    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function relationshipTypeBadgeClass(type: RelationshipType) {
  switch (type) {
    case "individual_coaching":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "group_coaching":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "leadership_coaching":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "pastoral_coaching":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "missionary_coaching":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

const RELATIONSHIP_TYPE_LABELS: Record<
  RelationshipType,
  { fallback: string; key: string }
> = {
  group_coaching: {
    fallback: "그룹 코칭",
    key: "myCoaching.relationships.type.group_coaching",
  },
  individual_coaching: {
    fallback: "개인 코칭",
    key: "myCoaching.relationships.type.individual_coaching",
  },
  leadership_coaching: {
    fallback: "리더십 코칭",
    key: "myCoaching.relationships.type.leadership_coaching",
  },
  missionary_coaching: {
    fallback: "선교사 코칭",
    key: "myCoaching.relationships.type.missionary_coaching",
  },
  pastoral_coaching: {
    fallback: "목회 코칭",
    key: "myCoaching.relationships.type.pastoral_coaching",
  },
};

const RELATIONSHIP_STATUS_LABELS: Record<
  CoachingRelationshipStatus,
  { fallback: string; key: string }
> = {
  active: {
    fallback: "활성",
    key: "myCoaching.relationships.status.active",
  },
  archived: {
    fallback: "보관됨",
    key: "myCoaching.relationships.status.archived",
  },
  ended: {
    fallback: "종료",
    key: "myCoaching.relationships.status.ended",
  },
  paused: {
    fallback: "일시중지",
    key: "myCoaching.relationships.status.paused",
  },
};

const SCOPE_LABELS: Record<ScopeType, { fallback: string; key: string }> = {
  church: {
    fallback: "교회",
    key: "myCoaching.relationships.scope.church",
  },
  coach: {
    fallback: "코치",
    key: "myCoaching.relationships.scope.coach",
  },
  cohort: {
    fallback: "코호트",
    key: "myCoaching.relationships.scope.cohort",
  },
  country: {
    fallback: "국가",
    key: "myCoaching.relationships.scope.country",
  },
  global: {
    fallback: "전체",
    key: "myCoaching.relationships.scope.global",
  },
  group: {
    fallback: "그룹",
    key: "myCoaching.relationships.scope.group",
  },
  organization: {
    fallback: "기관",
    key: "myCoaching.relationships.scope.organization",
  },
  region: {
    fallback: "지역",
    key: "myCoaching.relationships.scope.region",
  },
};

function shortenScopeId(scopeId: string) {
  if (scopeId.length <= 12) {
    return scopeId;
  }

  return `${scopeId.slice(0, 8)}...${scopeId.slice(-4)}`;
}

function RelationshipTypeLabel({ type }: { type: RelationshipType }) {
  const label = RELATIONSHIP_TYPE_LABELS[type];

  return <I18nText k={label.key} fallback={label.fallback} />;
}

function RelationshipStatusLabel({
  status,
}: {
  status: CoachingRelationshipStatus;
}) {
  const label = RELATIONSHIP_STATUS_LABELS[status];

  return <I18nText k={label.key} fallback={label.fallback} />;
}

function ScopeLabel({
  scopeId,
  scopeType,
}: {
  scopeId: string | null | undefined;
  scopeType: ScopeType;
}) {
  const label = SCOPE_LABELS[scopeType];

  if (scopeType === "global") {
    return <I18nText k="myCoaching.relationships.scope.all" fallback="전체" />;
  }

  if (!scopeId) {
    return <I18nText k={label.key} fallback={label.fallback} />;
  }

  return (
    <>
      <I18nText k={label.key} fallback={label.fallback} />:{" "}
      {shortenScopeId(scopeId)}
    </>
  );
}

export default async function MyCoachingPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching");
  }

  const result = await getMyCoachingMe();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching");
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            <I18nText k="myCoaching.badge" fallback="코칭" />
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            <I18nText k="myCoaching.title" fallback="내 코칭 공간" />
          </h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText k="myCoaching.loadFailed" fallback="지금 코칭 공간을 불러올 수 없습니다." />
          </div>
        </section>
      </main>
    );
  }

  const { authEmail, profile, relationships } = result.data;
  const welcomeName =
    profile?.display_name ??
    profile?.full_name ??
    profile?.email ??
    authEmail ??
    "사용자";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="myCoaching.badge" fallback="코칭" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="myCoaching.title" fallback="내 코칭 공간" />
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="myCoaching.subtitle"
                fallback="내 계정에 연결된 코칭 관계를 읽기 전용으로 확인할 수 있습니다."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
            <Link
              className="font-medium text-slate-700 underline"
              href="/dashboard"
            >
              <I18nText k="myCoaching.backToDashboard" fallback="대시보드로 돌아가기" />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/my-coaching/records"
            >
              <I18nText k="myCoaching.myRecords" fallback="나의 기록" />
            </Link>
            <Link
              className="font-medium text-slate-700 underline"
              href="/profile"
            >
              <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">
            <I18nText k="myCoaching.welcome" fallback="환영합니다" />
          </h2>
          <p className="mt-3 text-slate-700">
            <I18nText k="myCoaching.hello" fallback="안녕하세요" />,{" "}
            <span className="font-medium text-slate-950">{welcomeName}</span>
            <I18nText k="myCoaching.nameSuffix" fallback="님." />
          </p>
          <p className="mt-2 text-slate-600">
            <I18nText k="myCoaching.intro" fallback="여기는 내 코칭 공간입니다." />
          </p>
        </section>

        {profile === null ? (
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">
              <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
            </p>
            <p className="mt-2 text-slate-600">
              <I18nText k="dashboard.acceptInvitationFirst" fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요." />
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/profile"
              >
                <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.myCoach" fallback="내 코치" />
              </h2>
              {relationships.length === 0 ? (
                <p className="mt-4 text-slate-700">
                  <I18nText k="myCoaching.noCoach" fallback="아직 배정된 코치가 없습니다." />
                </p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {relationships.map((relationship) => (
                    <div
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                      key={`coach-${relationship.id}`}
                    >
                      <p className="text-sm font-medium text-slate-500">
                        <I18nText k="roles.coach" fallback="코치" />
                      </p>
                      <p className="mt-2 font-medium text-slate-950">
                        {relationship.coach_display_name ??
                          relationship.coach_full_name ??
                          relationship.coach_email ??
                          "알 수 없음"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {relationship.coach_email ?? "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.myRelationships" fallback="내 코칭 관계" />
              </h2>
              {relationships.length === 0 ? (
                <p className="mt-4 text-slate-700">
                  <I18nText k="myCoaching.noCoach" fallback="아직 배정된 코치가 없습니다." />
                </p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {relationships.map((relationship) => (
                    <article
                      className="rounded-md border border-slate-200 p-5"
                      key={relationship.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipTypeBadgeClass(
                            relationship.relationshipType,
                          )}`}
                        >
                          <RelationshipTypeLabel
                            type={relationship.relationshipType}
                          />
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${relationshipStatusBadgeClass(
                            relationship.status,
                          )}`}
                        >
                          <RelationshipStatusLabel
                            status={relationship.status}
                          />
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            <I18nText
                              k="myCoaching.relationships.scope"
                              fallback="범위"
                            />
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            <ScopeLabel
                              scopeId={relationship.scopeId}
                              scopeType={relationship.scopeType}
                            />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            <I18nText
                              k="myCoaching.relationships.startDate"
                              fallback="시작일"
                            />
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDate(relationship.startedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            <I18nText
                              k="myCoaching.relationships.createdAt"
                              fallback="생성일"
                            />
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDate(relationship.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-500">
                            <I18nText
                              k="myCoaching.relationships.endedAt"
                              fallback="종료일"
                            />
                          </dt>
                          <dd className="mt-1 text-slate-950">
                            {formatDate(relationship.endedAt)}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.myMoksilgi" fallback="나의 목실기" />
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                <I18nText
                  k="myCoaching.myMoksilgiDescription"
                  fallback="목실기 목표 작성, 월별 점검, 연간 성취표를 한곳에서 확인합니다."
                />
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/moksilgi"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText k="myCoaching.writeMoksilgi" fallback="목실기 작성하기" />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.writeMoksilgiDescription"
                      fallback="나의 목실기 목표와 세부 내용을 작성합니다."
                    />
                  </p>
                </Link>
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/moksilgi/monthly"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText k="myCoaching.monthlyMoksilgi" fallback="월별 목실기 점검" />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.monthlyMoksilgiDescription"
                      fallback="월별 실행 기록과 달성률을 점검합니다."
                    />
                  </p>
                </Link>
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/moksilgi/summary"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText k="myCoaching.viewAchievement" fallback="나의 성취표 보기" />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.viewAchievementDescription"
                      fallback="연간 목실기 성취 현황을 확인합니다."
                    />
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.myRecords" fallback="나의 기록" />
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                <I18nText
                  k="myCoaching.recordsDescription"
                  fallback="하루, 주간, 월간 단위로 나의 코칭 여정과 실천 내용을 기록합니다."
                />
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/records"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText k="myCoaching.chooseRecord" fallback="기록 선택하기" />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.chooseRecordDescription"
                      fallback="하루 기록, 주간 기록, 월간 기록 중 필요한 기록 방식을 선택합니다."
                    />
                  </p>
                </Link>
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/spiritual-companion"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText
                      k="myCoaching.spiritualCompanion.cardTitle"
                      fallback="AI 영적 형성 도우미"
                    />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.spiritualCompanion.cardDescription"
                      fallback="기도 제목, 감사 제목, 묵상 주제를 바탕으로 짧은 묵상 질문을 받아볼 수 있습니다."
                    />
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                <I18nText k="myCoaching.coachFeedback" fallback="코치 피드백" />
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                <I18nText
                  k="myCoaching.coachFeedbackDescription"
                  fallback="코치가 남긴 피드백을 확인하고 다음 실행을 준비합니다."
                />
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href="/my-coaching/feedback"
                >
                  <p className="font-medium text-slate-950">
                    <I18nText k="myCoaching.viewFeedback" fallback="피드백 보기" />
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <I18nText
                      k="myCoaching.viewFeedbackDescription"
                      fallback="공개된 코치 피드백을 확인합니다."
                    />
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  <I18nText k="dashboard.profile" fallback="프로필" />
                </h2>
                <Link
                  className="text-sm font-medium text-slate-700 underline"
                  href="/profile"
                >
                  <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
                </Link>
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    <I18nText k="dashboard.displayName" fallback="표시 이름" />
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(profile.display_name)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    <I18nText k="members.email" fallback="이메일" />
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(profile.email)}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
