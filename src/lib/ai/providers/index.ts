import { mockAiProvider } from "./mock";
import { openAiProvider } from "./openai";
import type { AiProvider } from "./types";

const SUPPORTED_PROVIDERS = ["openai", "cloudflare", "oci", "mock"] as const;

type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

function normalizeProviderName(value: string | undefined): ProviderName {
  const normalized = value?.trim().toLowerCase();

  return SUPPORTED_PROVIDERS.includes(normalized as ProviderName)
    ? (normalized as ProviderName)
    : "mock";
}

export function getAiProvider(): AiProvider {
  const providerName = normalizeProviderName(process.env.AI_PROVIDER);

  if (providerName === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      console.warn("[AI_PROVIDER_OPENAI_MISSING_KEY] Falling back to mock provider.");
      return mockAiProvider;
    }

    return openAiProvider;
  }

  if (providerName !== "mock") {
    console.warn(
      `[AI_PROVIDER_UNIMPLEMENTED] ${providerName} is not implemented yet. Falling back to mock provider.`,
    );
  }

  return mockAiProvider;
}

export type { AiProvider, CompanionLocale } from "./types";
