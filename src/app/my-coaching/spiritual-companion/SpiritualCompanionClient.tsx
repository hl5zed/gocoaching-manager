"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createSpiritualCompanionReply,
  getSpiritualCompanionMessages,
  type SpiritualCompanionMessage,
  SpiritualCompanionApiError,
} from "@/lib/api/my-coaching/spiritual-companion";
import { useI18n } from "@/lib/i18n/useI18n";

const MAX_VISIBLE_INPUT_LENGTH = 1500;

const EXAMPLE_PROMPTS = [
  {
    key: "myCoaching.spiritualCompanion.examples.gratitude",
    fallback: "오늘 감사한 일과 기도 제목을 정리하고 싶습니다.",
  },
  {
    key: "myCoaching.spiritualCompanion.examples.weary",
    fallback: "마음이 지쳐 있는데 짧은 묵상 질문을 받고 싶습니다.",
  },
  {
    key: "myCoaching.spiritualCompanion.examples.ministry",
    fallback: "이번 주 사역을 돌아보며 기도하고 싶습니다.",
  },
];

export function SpiritualCompanionClient() {
  const { locale, t } = useI18n();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [savedMessages, setSavedMessages] = useState<SpiritualCompanionMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const trimmedMessage = message.trim();
  const isSubmitDisabled = isLoading || trimmedMessage.length === 0;

  const loadSavedMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    setMessagesError(null);

    try {
      const messages = await getSpiritualCompanionMessages();
      setSavedMessages(messages);
    } catch {
      setMessagesError(
        t(
          "myCoaching.spiritualCompanion.messagesLoadFailed",
          "저장된 대화를 불러올 수 없습니다.",
        ),
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSavedMessages();
  }, [loadSavedMessages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedMessage) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setAnswer(null);

    try {
      const result = await createSpiritualCompanionReply({
        locale,
        message: trimmedMessage,
      });

      setAnswer(result.answer);
      setRemainingToday(result.remainingToday);
      setProviderLabel(result.model ? `${result.provider} / ${result.model}` : result.provider);
      await loadSavedMessages();
    } catch (error) {
      if (error instanceof SpiritualCompanionApiError && error.status === 429) {
        setErrorMessage(
          t(
            "myCoaching.spiritualCompanion.limitReached",
            "오늘의 생성 가능 횟수를 모두 사용했습니다.",
          ),
        );
        setRemainingToday(error.remainingToday ?? 0);
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t(
                "myCoaching.spiritualCompanion.error",
                "지금 AI 응답을 생성할 수 없습니다.",
              ),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <form
        className="rounded-card border border-line-base bg-surface-card p-6"
        onSubmit={handleSubmit}
      >
        <div>
          <h2 className="text-lg font-semibold text-ink-strong">
            {t("myCoaching.spiritualCompanion.inputTitle", "오늘의 마음 나누기")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t(
              "myCoaching.spiritualCompanion.inputDescription",
              "감사한 일, 기도 제목, 묵상 주제 중 하나를 짧게 적어 주세요.",
            )}
          </p>
        </div>

        <label
          className="mt-5 block text-sm font-medium text-ink-base"
          htmlFor="spiritual-companion-message"
        >
          {t("myCoaching.spiritualCompanion.messageLabel", "나눌 내용")}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              className="rounded-full border border-line-base bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink-base transition hover:border-line-base hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              key={prompt.key}
              onClick={() => setMessage(t(prompt.key, prompt.fallback))}
              type="button"
            >
              {t(prompt.key, prompt.fallback)}
            </button>
          ))}
        </div>
        <textarea
          className="mt-2 min-h-48 w-full rounded-control border border-line-base px-3 py-2 text-sm leading-6 text-ink-strong"
          id="spiritual-companion-message"
          maxLength={MAX_VISIBLE_INPUT_LENGTH}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t(
            "myCoaching.spiritualCompanion.placeholder",
            "오늘 감사한 일과 기도 제목을 적어 보세요.",
          )}
          value={message}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
          <span>
            {t(
              "myCoaching.spiritualCompanion.privateNotice",
              "기본 공개 범위는 나만 보기입니다.",
            )}
          </span>
          <span>
            {message.length}/{MAX_VISIBLE_INPUT_LENGTH}
          </span>
        </div>

        <button
          className="mt-5 w-full rounded-control bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitDisabled}
          type="submit"
        >
          {isLoading
            ? t("myCoaching.spiritualCompanion.generating", "생성 중...")
            : t("myCoaching.spiritualCompanion.generate", "묵상 질문 받기")}
        </button>

        {remainingToday !== null ? (
          <p className="mt-3 text-sm text-ink-muted">
            {t("myCoaching.spiritualCompanion.remainingPrefix", "오늘 남은 생성 횟수")}:{" "}
            <span className="font-medium text-ink-strong">{remainingToday}</span>
            {t("myCoaching.spiritualCompanion.remainingSuffix", "회")}
          </p>
        ) : null}
      </form>

      <section className="rounded-card border border-line-base bg-surface-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-ink-strong">
            {t("myCoaching.spiritualCompanion.answerTitle", "AI 영적 형성 응답")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t(
              "myCoaching.spiritualCompanion.answerDescription",
              "응답은 목회적 조언이 아닌 개인 묵상을 돕는 짧은 질문과 실천 제안입니다.",
            )}
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-control border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {answer ? (
          <div className="mt-5 rounded-control border border-emerald-200 bg-emerald-50 p-4">
            {providerLabel ? (
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-emerald-700">
                {providerLabel}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink-base">
              {answer}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-control border border-line-base bg-surface-sunken p-4 text-sm leading-6 text-ink-muted">
            {t(
              "myCoaching.spiritualCompanion.emptyAnswer",
              "묵상 가이드를 생성하면 이곳에 응답이 표시됩니다.",
            )}
          </div>
        )}

        <div className="mt-6 border-t border-line-soft pt-5">
          <h3 className="text-sm font-semibold text-ink-strong">
            {t("myCoaching.spiritualCompanion.savedMessagesTitle", "최근 저장된 대화")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-ink-faint">
            {t(
              "myCoaching.spiritualCompanion.savedMessagesDescription",
              "최근 20개 메시지를 시간순으로 표시합니다.",
            )}
          </p>

          {isLoadingMessages ? (
            <div className="mt-4 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
              {t("myCoaching.spiritualCompanion.messagesLoading", "저장된 대화를 불러오는 중입니다.")}
            </div>
          ) : messagesError ? (
            <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              {messagesError}
            </div>
          ) : savedMessages.length === 0 ? (
            <div className="mt-4 rounded-control border border-line-base bg-surface-sunken p-4 text-sm text-ink-muted">
              {t("myCoaching.spiritualCompanion.noSavedMessages", "아직 저장된 대화가 없습니다.")}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {savedMessages.map((savedMessage) => {
                const isUserMessage = savedMessage.role === "user";

                return (
                  <article
                    className={`rounded-card border p-3 ${
                      isUserMessage
                        ? "border-line-base bg-surface-card"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                    key={savedMessage.id}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          isUserMessage ? "text-ink-base" : "text-emerald-700"
                        }`}
                      >
                        {isUserMessage
                          ? t("myCoaching.spiritualCompanion.messageRole.user", "나")
                          : t(
                              "myCoaching.spiritualCompanion.messageRole.assistant",
                              "AI 도우미",
                            )}
                      </span>
                      {savedMessage.createdAt ? (
                        <time className="text-ink-faint" dateTime={savedMessage.createdAt}>
                          {new Date(savedMessage.createdAt).toLocaleString()}
                        </time>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink-base">
                      {savedMessage.content}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
