import { ulid } from "ulid";

/** Durable, sortable ids with a readable prefix, e.g. `run_01JB…`. */
export const ID_PREFIXES = {
  run: "run",
  policy: "pol",
  rule: "rul",
  step: "stp",
  violation: "vio",
  verdict: "vrd",
  lineage: "lin",
  job: "job",
  review: "rev",
  task: "tsk",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

export function newId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`;
}
