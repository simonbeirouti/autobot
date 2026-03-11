import { ChatOpenAI } from "@langchain/openai";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";

function readOpenAiKey() {
  return (
    process.env.OPENAI_API_KEY ??
    process.env.openai_api_key ??
    process.env.NEXT_PRIVATE_OPENAI_API_KEY ??
    null
  );
}

export function getConfiguredModel(): BaseLanguageModel | null {
  const apiKey = readOpenAiKey();

  if (!apiKey) {
    return null;
  }

  return new ChatOpenAI({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.2,
  });
}

