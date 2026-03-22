import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

import {
  clarificationResultSchema,
  type ClarificationResult,
} from "@/lib/agents/schemas";

export type ClarifierProvider = "openai" | "anthropic";

export type ClarificationRequest = {
  systemPrompt: string;
  userPrompt: string;
};

export type ConfiguredClarifier = {
  provider: ClarifierProvider;
  modelName: string;
  generateClarification: (request: ClarificationRequest) => Promise<ClarificationResult>;
};

export type ConfiguredChatModel = {
  provider: ClarifierProvider;
  modelName: string;
  invoke: (messages: BaseMessage[]) => Promise<{ content: BaseMessage["content"] }>;
  bindTools: (
    tools: DynamicStructuredTool[],
  ) => {
    invoke: (messages: BaseMessage[]) => Promise<{
      content: BaseMessage["content"];
      tool_calls?: Array<{
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }>;
    }>;
  };
  withStructuredOutput: <TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    options?: { name?: string; strict?: boolean; method?: "jsonSchema" },
  ) => {
    invoke: (messages: BaseMessage[]) => Promise<z.infer<TSchema>>;
  };
};

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readConfiguredProvider(): ClarifierProvider | null {
  const configured = readEnv("LLM_PROVIDER", "llm_provider")?.toLowerCase();

  if (configured === "openai" || configured === "anthropic") {
    return configured;
  }

  if (readEnv("OPENAI_API_KEY", "openai_api_key", "NEXT_PRIVATE_OPENAI_API_KEY")) {
    return "openai";
  }

  if (readEnv("ANTHROPIC_API_KEY", "anthropic_api_key")) {
    return "anthropic";
  }

  return null;
}

function createOpenAiClarifier(): ConfiguredClarifier | null {
  const apiKey = readEnv(
    "OPENAI_API_KEY",
    "openai_api_key",
    "NEXT_PRIVATE_OPENAI_API_KEY",
  );

  if (!apiKey) {
    return null;
  }

  const modelName = readEnv("OPENAI_MODEL", "openai_model") ?? "gpt-4.1-mini";
  const model = new ChatOpenAI({
    apiKey,
    model: modelName,
    temperature: 0.2,
  }).withStructuredOutput(clarificationResultSchema, {
    name: "clarification_result",
    strict: true,
  });

  return {
    provider: "openai",
    modelName,
    async generateClarification(request) {
      const result = await model.invoke([
        new SystemMessage(request.systemPrompt),
        new HumanMessage(request.userPrompt),
      ]);

      return clarificationResultSchema.parse(result);
    },
  };
}

function createOpenAiChatModel(): ConfiguredChatModel | null {
  const apiKey = readEnv(
    "OPENAI_API_KEY",
    "openai_api_key",
    "NEXT_PRIVATE_OPENAI_API_KEY",
  );

  if (!apiKey) {
    return null;
  }

  const modelName = readEnv("OPENAI_MODEL", "openai_model") ?? "gpt-4.1-mini";
  const model = new ChatOpenAI({
    apiKey,
    model: modelName,
    temperature: 0.2,
  });

  return {
    provider: "openai",
    modelName,
    invoke: (messages) => model.invoke(messages),
    bindTools: (tools) => {
      const bound = model.bindTools(tools);
      return {
        invoke: (messages) => bound.invoke(messages),
      };
    },
    withStructuredOutput(schema, options) {
      const structured = model.withStructuredOutput(schema, {
        name: options?.name ?? "structured_output",
        strict: options?.strict ?? true,
      });

      return {
        invoke: async (messages) => schema.parse(await structured.invoke(messages)),
      };
    },
  };
}

function createAnthropicClarifier(): ConfiguredClarifier | null {
  const apiKey = readEnv("ANTHROPIC_API_KEY", "anthropic_api_key");

  if (!apiKey) {
    return null;
  }

  const modelName =
    readEnv("ANTHROPIC_MODEL", "anthropic_model") ?? "claude-sonnet-4-5";
  const model = new ChatAnthropic({
    apiKey,
    model: modelName,
    temperature: 0.2,
  }).withStructuredOutput(clarificationResultSchema, {
    name: "clarification_result",
    method: "jsonSchema",
  });

  return {
    provider: "anthropic",
    modelName,
    async generateClarification(request) {
      const result = await model.invoke([
        new SystemMessage(request.systemPrompt),
        new HumanMessage(request.userPrompt),
      ]);

      return clarificationResultSchema.parse(result);
    },
  };
}

function createAnthropicChatModel(): ConfiguredChatModel | null {
  const apiKey = readEnv("ANTHROPIC_API_KEY", "anthropic_api_key");

  if (!apiKey) {
    return null;
  }

  const modelName =
    readEnv("ANTHROPIC_MODEL", "anthropic_model") ?? "claude-sonnet-4-5";
  const model = new ChatAnthropic({
    apiKey,
    model: modelName,
    temperature: 0.2,
  });

  return {
    provider: "anthropic",
    modelName,
    invoke: (messages) => model.invoke(messages),
    bindTools: (tools) => {
      const bound = model.bindTools(tools);
      return {
        invoke: (messages) => bound.invoke(messages),
      };
    },
    withStructuredOutput(schema, options) {
      const structured = model.withStructuredOutput(schema, {
        name: options?.name ?? "structured_output",
        method: options?.method ?? "jsonSchema",
      });

      return {
        invoke: async (messages) => schema.parse(await structured.invoke(messages)),
      };
    },
  };
}

export function getConfiguredClarifier(): ConfiguredClarifier | null {
  const provider = readConfiguredProvider();

  if (!provider) {
    return null;
  }

  if (provider === "openai") {
    return createOpenAiClarifier();
  }

  return createAnthropicClarifier();
}

export function getConfiguredChatModel(): ConfiguredChatModel | null {
  const provider = readConfiguredProvider();

  if (!provider) {
    return null;
  }

  if (provider === "openai") {
    return createOpenAiChatModel();
  }

  return createAnthropicChatModel();
}
