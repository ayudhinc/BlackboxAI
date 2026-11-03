import { describe, expect, it } from "vitest";
import { isLocal, isR2, storeFromEnv } from "./factory.ts";

const r2 = {
  R2_BUCKET: "b",
  R2_ACCOUNT_ID: "a",
  R2_ACCESS_KEY_ID: "k",
  R2_SECRET_ACCESS_KEY: "s",
};

describe("storeFromEnv", () => {
  it("stays on local disk in development even when R2 keys are present", () => {
    expect(isLocal(storeFromEnv({ ...r2, NODE_ENV: "development" }))).toBe(true);
  });

  it("uses R2 in development only when BLOB_STORE=r2", () => {
    expect(isR2(storeFromEnv({ ...r2, BLOB_STORE: "r2" }))).toBe(true);
  });

  it("uses R2 in production and names what is missing instead of falling back", () => {
    expect(isR2(storeFromEnv({ ...r2, NODE_ENV: "production" }))).toBe(true);
    expect(() => storeFromEnv({ NODE_ENV: "production", R2_BUCKET: "b" })).toThrow(
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY is not set/,
    );
  });
});
