export type LlmProvider = "none" | "gemma-http" | "ollama";

export type LlmRequest = {
  system: string;
  prompt: string;
  maxTokens?: number;
};

export type LlmResult = {
  configured: boolean;
  provider: LlmProvider;
  model: string | null;
  text: string | null;
  error?: {
    name: string;
    message: string;
  };
};

function providerFromEnv(): LlmProvider {
  const provider = process.env.GRAPHFLOW_AGENT_PROVIDER;

  if (provider === "gemma-http" || provider === "ollama" || provider === "none") {
    return provider;
  }

  return process.env.GRAPHFLOW_LLM_ENDPOINT ? "gemma-http" : "none";
}

export function getAgentConfig() {
  const provider = providerFromEnv();

  return {
    provider,
    endpoint: process.env.GRAPHFLOW_LLM_ENDPOINT,
    model: process.env.GRAPHFLOW_LLM_MODEL ?? "gemma",
    configured: provider !== "none" && Boolean(process.env.GRAPHFLOW_LLM_ENDPOINT),
  };
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: "The model provider failed before returning a response.",
  };
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as {
    response?: unknown;
    text?: unknown;
    content?: unknown;
    choices?: Array<{
      message?: {
        content?: unknown;
      };
      text?: unknown;
    }>;
  };

  if (typeof data.response === "string") {
    return data.response;
  }

  if (typeof data.text === "string") {
    return data.text;
  }

  if (typeof data.content === "string") {
    return data.content;
  }

  const choice = data.choices?.[0];

  if (typeof choice?.message?.content === "string") {
    return choice.message.content;
  }

  if (typeof choice?.text === "string") {
    return choice.text;
  }

  return null;
}

async function postJson(input: {
  endpoint: string;
  body: Record<string, unknown>;
  apiKey?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GRAPHFLOW_LLM_TIMEOUT_MS ?? 7000));

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM provider returned HTTP ${response.status}.`);
    }

    return response.json() as Promise<unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeWithAgentModel(request: LlmRequest): Promise<LlmResult> {
  const config = getAgentConfig();

  if (!config.configured || !config.endpoint) {
    return {
      configured: false,
      provider: config.provider,
      model: null,
      text: null,
    };
  }

  try {
    const payload =
      config.provider === "ollama"
        ? await postJson({
            endpoint: config.endpoint,
            body: {
              model: config.model,
              prompt: `${request.system}\n\n${request.prompt}`,
              stream: false,
            },
          })
        : await postJson({
            endpoint: config.endpoint,
            apiKey: process.env.GRAPHFLOW_LLM_API_KEY,
            body: {
              model: config.model,
              messages: [
                { role: "system", content: request.system },
                { role: "user", content: request.prompt },
              ],
              temperature: 0.2,
              max_tokens: request.maxTokens ?? 500,
            },
          });

    return {
      configured: true,
      provider: config.provider,
      model: config.model,
      text: extractText(payload),
    };
  } catch (error) {
    return {
      configured: true,
      provider: config.provider,
      model: config.model,
      text: null,
      error: safeError(error),
    };
  }
}
