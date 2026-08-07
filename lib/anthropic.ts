const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 8000;

export interface AnthropicRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function isAnthropicRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("insufficient") ||
      message.includes("credit") ||
      message.includes("rate limit") ||
      message.includes("overloaded") ||
      message.includes("timeout") ||
      message.includes("429")
    );
  }

  if (typeof error === "object" && error !== null) {
    const maybe = error as {
      type?: string;
      status?: number;
      message?: string;
      code?: string;
    };

    const type = maybe.type?.toLowerCase() ?? "";
    const code = maybe.code?.toLowerCase() ?? "";
    const message = (maybe.message ?? "").toLowerCase();
    return (
      type.includes("insufficient") ||
      type.includes("credit") ||
      type.includes("rate") ||
      code.includes("rate_limit") ||
      code.includes("overloaded") ||
      maybe.status === 429 ||
      message.includes("insufficient") ||
      message.includes("credit") ||
      message.includes("rate limit") ||
      message.includes("overloaded") ||
      message.includes("timeout")
    );
  }

  return false;
}

export async function withAnthropicRetry<T>(
  operation: () => Promise<T>,
  options: AnthropicRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  let delayMs = initialDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!isAnthropicRetryableError(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
}
