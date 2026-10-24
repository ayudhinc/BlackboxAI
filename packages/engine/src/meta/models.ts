/**
 * The Meta models BlackboxAI calls, and their prices. Prices are from
 * docs/meta-stack.md (dev.meta.ai, verified 2026-10-23); real spend is the sum
 * of lineage rows, not this table.
 */
export const MODELS = {
  spark: "muse-spark-1.3",
  sam: "sam-3.1",
  wonder: "muse-wonder-1.0",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

type TokenPricing = { kind: "tokens"; inPerM: number; cachedInPerM: number; outPerM: number };
type FramePricing = {
  kind: "frames";
  perVideoFrame: number;
  perImage: number;
  minVideoFrames: number;
};

export const PRICING: Record<ModelId, TokenPricing | FramePricing> = {
  "muse-spark-1.3": { kind: "tokens", inPerM: 1.25, cachedInPerM: 0.15, outPerM: 4.25 },
  "muse-wonder-1.0": { kind: "tokens", inPerM: 4, cachedInPerM: 4, outPerM: 20 },
  "sam-3.1": {
    kind: "frames",
    perVideoFrame: 0.2 / 1000,
    perImage: 2.5 / 1000,
    minVideoFrames: 50,
  },
};

/**
 * Only the models above may be called. `-contributor` variants train Meta's
 * models on what they are sent and are refused outright, whatever the caller
 * asks for.
 */
export function assertAllowedModel(model: string): asserts model is ModelId {
  if (model.includes("contributor")) {
    throw new Error(`Refusing model "${model}": contributor variants are never used.`);
  }
  if (!(model in PRICING)) {
    throw new Error(`Refusing model "${model}": not in the BlackboxAI model table.`);
  }
}

export type TokenUsage = { tokensIn: number; tokensCached: number; tokensOut: number };

export function tokenCostUsd(model: ModelId, usage: TokenUsage): number {
  const p = PRICING[model];
  if (p.kind !== "tokens") throw new Error(`${model} is not priced by tokens`);
  const uncached = Math.max(0, usage.tokensIn - usage.tokensCached);
  return (
    (uncached * p.inPerM + usage.tokensCached * p.cachedInPerM + usage.tokensOut * p.outPerM) /
    1_000_000
  );
}

export function samVideoCostUsd(framesProcessed: number): number {
  const p = PRICING["sam-3.1"];
  if (p.kind !== "frames") throw new Error("sam-3.1 is priced by frames");
  return Math.max(framesProcessed, p.minVideoFrames) * p.perVideoFrame;
}

export function samImageCostUsd(images: number): number {
  const p = PRICING["sam-3.1"];
  if (p.kind !== "frames") throw new Error("sam-3.1 is priced by frames");
  return images * p.perImage;
}
