export type SpiritualCompanionLocale = "ko" | "en" | "th";

export type SpiritualCompanionResponse = {
  answer: string;
  model?: string;
  provider: string;
  remainingToday: number;
};

export type SpiritualCompanionMessage = {
  content: string;
  createdAt: string;
  id: string;
  model: string | null;
  provider: string;
  role: "user" | "assistant" | "system";
  userLocalDate: string;
};

export class SpiritualCompanionApiError extends Error {
  remainingToday?: number;
  status: number;

  constructor(message: string, status: number, remainingToday?: number) {
    super(message);
    this.name = "SpiritualCompanionApiError";
    this.remainingToday = remainingToday;
    this.status = status;
  }
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

function readRemainingToday(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "remainingToday" in payload &&
    typeof payload.remainingToday === "number"
  ) {
    return payload.remainingToday;
  }

  return undefined;
}

function readMessages(payload: unknown): SpiritualCompanionMessage[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("messages" in payload) ||
    !Array.isArray(payload.messages)
  ) {
    throw new SpiritualCompanionApiError(
      "저장된 대화 응답 형식을 확인할 수 없습니다.",
      500,
    );
  }

  return payload.messages
    .filter((message): message is Record<string, unknown> => {
      return Boolean(message) && typeof message === "object";
    })
    .map((message) => {
      const role =
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "system"
          ? message.role
          : "assistant";

      return {
        content: typeof message.content === "string" ? message.content : "",
        createdAt:
          typeof message.created_at === "string" ? message.created_at : "",
        id: typeof message.id === "string" ? message.id : crypto.randomUUID(),
        model: typeof message.model === "string" ? message.model : null,
        provider:
          typeof message.provider === "string" ? message.provider : "mock",
        role,
        userLocalDate:
          typeof message.user_local_date === "string"
            ? message.user_local_date
            : "",
      };
    });
}

export async function getSpiritualCompanionMessages(): Promise<
  SpiritualCompanionMessage[]
> {
  const response = await fetch("/api/my-coaching/spiritual-companion", {
    cache: "no-store",
    method: "GET",
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new SpiritualCompanionApiError(
      readErrorMessage(payload, "저장된 대화를 불러올 수 없습니다."),
      response.status,
      readRemainingToday(payload),
    );
  }

  return readMessages(payload);
}

export async function createSpiritualCompanionReply(input: {
  locale: SpiritualCompanionLocale;
  message: string;
}): Promise<SpiritualCompanionResponse> {
  const response = await fetch("/api/my-coaching/spiritual-companion", {
    body: JSON.stringify(input),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new SpiritualCompanionApiError(
      readErrorMessage(payload, "AI 응답을 생성할 수 없습니다."),
      response.status,
      readRemainingToday(payload),
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("answer" in payload) ||
    typeof payload.answer !== "string" ||
    !("provider" in payload) ||
    typeof payload.provider !== "string" ||
    !("remainingToday" in payload) ||
    typeof payload.remainingToday !== "number"
  ) {
    throw new SpiritualCompanionApiError(
      "AI 응답 형식을 확인할 수 없습니다.",
      500,
    );
  }

  return {
    answer: payload.answer,
    model:
      "model" in payload && typeof payload.model === "string"
        ? payload.model
        : undefined,
    provider: payload.provider,
    remainingToday: payload.remainingToday,
  };
}
