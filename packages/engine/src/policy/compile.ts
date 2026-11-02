/**
 * Stage 4, compile policy: a policy document in, typed rules out, each with a
 * plain-English read-back and a source quote. Ambiguity is surfaced as
 * needs_clarification and blocks checking until an operator resolves it.
 */
import { type Rule, RuleType } from "@blackbox/contracts";
import { z } from "zod";
import { DATA_CLASS_PATTERNS } from "../check/checkers.ts";
import type { MetaClient } from "../meta/client.ts";
import type { ChatContentPart } from "../meta/transport.ts";

const DATA_CLASSES = Object.keys(DATA_CLASS_PATTERNS) as [string, ...string[]];

const CompiledRule = z.object({
  type: RuleType,
  status: z.enum(["ready", "needs_clarification"]),
  clarification: z
    .string()
    .nullable()
    .describe("If needs_clarification: the question an operator must answer"),
  readBack: z
    .string()
    .describe("The rule restated in one plain-English sentence, including any default you applied"),
  sourcePage: z.number().int().min(1),
  sourceQuote: z
    .string()
    .describe("A short verbatim quote from the policy that this rule comes from"),
  apps: z.array(z.string()).nullable().describe("app_allowlist: allowed application names"),
  hosts: z.array(z.string()).nullable().describe("app_allowlist: allowed web hosts, if named"),
  targets: z
    .array(z.string())
    .nullable()
    .describe("confirm_before_destroy: destructive verbs, lower case"),
  dialogWithinMs: z
    .number()
    .int()
    .nullable()
    .describe("confirm_before_destroy: default 3000 if the policy is silent"),
  maxRepeats: z
    .number()
    .int()
    .nullable()
    .describe("loop_limit: allowed repeats; null if the policy gives no number"),
  classes: z
    .array(z.enum(DATA_CLASSES))
    .nullable()
    .describe("data_class_ban: banned field classes"),
  maxMs: z.number().int().nullable().describe("max_duration: limit in milliseconds"),
});

export const CompiledPolicy = z.object({
  title: z.string(),
  rules: z.array(CompiledRule),
});
export type CompiledPolicy = z.infer<typeof CompiledPolicy>;

const PARAMS: Record<Rule["type"], z.ZodType<Record<string, unknown>>> = {
  app_allowlist: z
    .object({ apps: z.array(z.string()).optional(), hosts: z.array(z.string()).optional() })
    .refine(
      (p) => (p.apps?.length ?? 0) + (p.hosts?.length ?? 0) > 0,
      "name at least one app or host",
    ),
  confirm_before_destroy: z.object({
    targets: z.array(z.string()).min(1),
    dialogWithinMs: z.number().int().positive(),
  }),
  loop_limit: z.object({ maxRepeats: z.number().int().positive() }),
  data_class_ban: z.object({ classes: z.array(z.string()).min(1) }),
  max_duration: z.object({ maxMs: z.number().int().positive() }),
  task_satisfied: z.object({ claimMustMatchScreen: z.literal(true) }),
};

const SYSTEM = `You compile an operating policy for software agents into machine-checkable rules.
Available rule types:
- app_allowlist: which applications or sites the agent may use. Give both the application names and any hosts the policy names.
- confirm_before_destroy: destructive actions must show a confirmation dialog first.
- loop_limit: how many times the agent may repeat the same action on the same screen.
- data_class_ban: field types the agent must never type into (${DATA_CLASSES.join(", ")}).
- max_duration: the time limit for one run.
- task_satisfied: the task must be completed and the agent's claim must match the screen.
Emit one rule per policy clause that maps to a type. If a clause needs a number or list the policy does not give, set status needs_clarification, leave that parameter null, and ask the question in clarification. Never invent a limit. The read-back must state any default you applied.`;

export type PolicyDocument =
  | { kind: "pdf"; filename: string; bytes: Uint8Array }
  | { kind: "text"; text: string };

export async function compilePolicy(
  client: MetaClient,
  policyId: string,
  doc: PolicyDocument,
): Promise<{ title: string; rules: Rule[] }> {
  const content: ChatContentPart[] = [{ type: "text", text: "Compile this policy." }];
  if (doc.kind === "pdf") {
    content.push({
      type: "file",
      file: {
        filename: doc.filename,
        file_data: `data:application/pdf;base64,${Buffer.from(doc.bytes).toString("base64")}`,
      },
    });
  } else {
    content.push({ type: "text", text: doc.text });
  }
  const compiled = await client.structured({
    subject: { stage: "compile_policy", policyId },
    schemaName: "compiled_policy",
    schema: CompiledPolicy,
    reasoningEffort: "high",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content },
    ],
  });
  return { title: compiled.title, rules: toRules(policyId, compiled) };
}

/** Validate each compiled rule's parameters; invalid ones become questions, not silent defaults. */
export function toRules(policyId: string, compiled: CompiledPolicy): Rule[] {
  return compiled.rules.map((r, i) => {
    const raw = {
      app_allowlist: {
        ...(r.apps?.length ? { apps: r.apps } : {}),
        ...(r.hosts?.length ? { hosts: r.hosts } : {}),
      },
      confirm_before_destroy: { targets: r.targets, dialogWithinMs: r.dialogWithinMs ?? 3000 },
      loop_limit: { maxRepeats: r.maxRepeats },
      data_class_ban: { classes: r.classes },
      max_duration: { maxMs: r.maxMs },
      task_satisfied: { claimMustMatchScreen: true },
    }[r.type];
    const parsed = PARAMS[r.type].safeParse(raw);
    const ready = r.status === "ready" && parsed.success;
    return {
      id: `R${i + 1}`,
      policyId,
      text: r.readBack,
      type: r.type,
      status: ready ? "ready" : "needs_clarification",
      clarification: ready
        ? null
        : (r.clarification ??
          `The policy does not give a usable value for this ${r.type.replaceAll("_", " ")} rule.`),
      params: parsed.success ? parsed.data : stripNulls(raw),
      sourceSpan: { page: r.sourcePage, quote: r.sourceQuote },
      signedOffBy: null,
      signedOffAt: null,
    };
  });
}

/** Resolve a needs_clarification rule with operator-supplied params. Fails loudly if they are invalid. */
export function resolveRule(rule: Rule, params: Record<string, unknown>, readBack?: string): Rule {
  const parsed = PARAMS[rule.type].safeParse({ ...rule.params, ...params });
  if (!parsed.success) {
    throw new Error(`Invalid parameters for ${rule.id}: ${z.prettifyError(parsed.error)}`);
  }
  return {
    ...rule,
    params: parsed.data,
    status: "ready",
    clarification: null,
    text: readBack ?? rule.text,
  };
}

function stripNulls(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}
