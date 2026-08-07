import { describe, expect, it, vi } from "vitest";
import { isAnthropicRetryableError, withAnthropicRetry } from "@/lib/anthropic";

describe("isAnthropicRetryableError", () => {
  it("recognizes insufficient-credit and rate-limit errors", () => {
    expect(isAnthropicRetryableError({ type: "insufficient_credits", message: "credits exhausted" })).toBe(true);
    expect(isAnthropicRetryableError({ status: 429, message: "rate limit exceeded" })).toBe(true);
    expect(isAnthropicRetryableError({ status: 400, message: "bad request" })).toBe(false);
  });
});

describe("withAnthropicRetry", () => {
  it("retries quota-related failures until success", async () => {
    let attempts = 0;
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await withAnthropicRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw { type: "insufficient_credits", message: "credits exhausted" };
        }
        return "done";
      },
      { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, sleep }
    );

    expect(result).toBe("done");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn();

    await expect(
      withAnthropicRetry(async () => {
        throw new Error("bad request");
      }, { maxAttempts: 3, sleep })
    ).rejects.toThrow("bad request");

    expect(sleep).not.toHaveBeenCalled();
  });
});
