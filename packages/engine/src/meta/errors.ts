/**
 * One error type for every failed Meta call. `party` says whose failure it is,
 * so user-facing text never blames the user for ours or the provider's:
 * - "ours": our configuration or our request was wrong (bad key, bad schema).
 * - "provider": Meta's side failed or refused (5xx, timeout, rate limit, bad output).
 * - "input": the user's media was rejected (unreadable video), with the reason.
 */
export type MetaFailure =
  | "auth"
  | "rate_limited"
  | "unavailable"
  | "rejected_request"
  | "rejected_input"
  | "refused"
  | "schema_invalid"
  | "incomplete";

const PARTY: Record<MetaFailure, "ours" | "provider" | "input"> = {
  auth: "ours",
  rate_limited: "provider",
  unavailable: "provider",
  rejected_request: "ours",
  rejected_input: "input",
  refused: "provider",
  schema_invalid: "provider",
  incomplete: "provider",
};

/** Failures worth one more attempt. Everything else fails the call at once. */
const RETRYABLE = new Set<MetaFailure>(["rate_limited", "unavailable", "schema_invalid"]);

export class MetaCallError extends Error {
  readonly party: "ours" | "provider" | "input";
  readonly retryable: boolean;

  constructor(
    readonly failure: MetaFailure,
    message: string,
    readonly status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MetaCallError";
    this.party = PARTY[failure];
    this.retryable = RETRYABLE.has(failure);
  }
}

/** Classify an HTTP status from the Model API. Media errors are told apart by the caller. */
export function failureForStatus(status: number): MetaFailure {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "rejected_request";
}
