import { describe, expect, it } from "vitest";
import { failureForStatus, MetaCallError } from "./errors.ts";

describe("failureForStatus", () => {
  it.each([
    [401, "auth", "ours", false],
    [402, "billing", "ours", false],
    [403, "auth", "ours", false],
    [400, "rejected_request", "ours", false],
    [429, "rate_limited", "provider", true],
    [500, "unavailable", "provider", true],
    [503, "unavailable", "provider", true],
  ] as const)("classifies %i as %s (%s, retryable %s)", (status, failure, party, retryable) => {
    expect(failureForStatus(status)).toBe(failure);
    const error = new MetaCallError(failureForStatus(status), "x", status);
    expect(error.party).toBe(party);
    expect(error.retryable).toBe(retryable);
  });
});
