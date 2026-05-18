export type CompanionLocale = "ko" | "en" | "th";

export type GenerateCompanionReplyInput = {
  context?: string;
  locale: CompanionLocale;
  maxOutputTokens: number;
  userMessage: string;
};

export type GenerateCompanionReplyResult = {
  inputTokens?: number;
  model?: string;
  outputTokens?: number;
  text: string;
};

export type AiProvider = {
  generateCompanionReply: (
    input: GenerateCompanionReplyInput,
  ) => Promise<GenerateCompanionReplyResult>;
  name: "openai" | "cloudflare" | "oci" | "mock";
};
