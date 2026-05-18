import type { AiProvider, CompanionLocale, GenerateCompanionReplyInput } from "./types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_OUTPUT_TOKENS = 500;

type OpenAIResponsePayload = {
  error?: {
    message?: string;
  };
  model?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

function getSystemPrompt(locale: CompanionLocale) {
  const basePrompt = [
    "You are a Christian spiritual formation companion for a coaching app.",
    "Offer concise reflection guidance, three gentle questions, one small practice, and a short prayer when appropriate.",
    "Do not condemn, shame, manipulate, or speak as if you are giving prophecy.",
    "Do not claim 'God says' or present your response as certain divine revelation.",
    "Encourage the user to seek pastoral, professional, or emergency help when they describe crisis, abuse, self-harm, or danger.",
    "Keep the response practical, humble, and within the user's selected language.",
  ].join(" ");

  if (locale === "ko") {
    return `${basePrompt} Respond in Korean.`;
  }

  if (locale === "th") {
    return `${basePrompt} Respond in Thai.`;
  }

  return `${basePrompt} Respond in English.`;
}

function getModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function getMaxOutputTokens(input: GenerateCompanionReplyInput) {
  return Math.min(input.maxOutputTokens, MAX_OUTPUT_TOKENS);
}

function extractText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OpenAI response did not include text output.");
  }

  return text;
}

export const openAiProvider: AiProvider = {
  async generateCompanionReply(input) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const model = getModel();
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: input.userMessage,
                type: "input_text",
              },
            ],
            role: "user",
            type: "message",
          },
        ],
        instructions: getSystemPrompt(input.locale),
        max_output_tokens: getMaxOutputTokens(input),
        model,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const payload = (await response.json()) as OpenAIResponsePayload;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? `OpenAI request failed with ${response.status}.`,
      );
    }

    return {
      inputTokens: payload.usage?.input_tokens,
      model: payload.model ?? model,
      outputTokens: payload.usage?.output_tokens,
      text: extractText(payload),
    };
  },
  name: "openai",
};
