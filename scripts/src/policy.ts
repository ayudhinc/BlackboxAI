/**
 * Compile a policy document and sign it off from the command line.
 *   pnpm policy compile <policy.pdf|.md> [--title "..."]
 *   pnpm policy resolve <policyId> <ruleId> '<json params>' ["read-back"]
 *   pnpm policy sign-off <policyId> <operator name>
 *   pnpm policy show <policyId>
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { newId } from "@blackbox/contracts";
import { schema } from "@blackbox/db";
import { compilePolicy, keys, loadRules, resolveRule } from "@blackbox/engine";
import { and, eq } from "drizzle-orm";
import { cliDeps } from "./cli-deps.ts";
import { userPath } from "./env.ts";

const [command, ...args] = process.argv.slice(2);
const deps = cliDeps();
const { db } = deps;

async function show(policyId: string): Promise<void> {
  const policy = await db.query.policies.findFirst({ where: eq(schema.policies.id, policyId) });
  if (!policy) throw new Error(`Policy ${policyId} not found`);
  console.log(`${policy.id}  ${policy.title}  [${policy.status}]`);
  for (const r of await loadRules(db, policyId)) {
    console.log(
      `  ${r.id} ${r.type.padEnd(22)} ${r.status === "ready" ? "ready" : "NEEDS CLARIFICATION"}  ${JSON.stringify(r.params)}`,
    );
    console.log(`     read-back: ${r.text}`);
    console.log(`     source p${r.sourceSpan.page}: "${r.sourceSpan.quote}"`);
    if (r.clarification) console.log(`     question: ${r.clarification}`);
    if (r.signedOffBy) console.log(`     signed off by ${r.signedOffBy} at ${r.signedOffAt}`);
  }
}

try {
  if (command === "compile") {
    const path = args[0];
    if (!path) throw new Error("usage: policy compile <file>");
    const policyId = newId("policy");
    const bytes = await readFile(userPath(path));
    const isPdf = extname(path).toLowerCase() === ".pdf";
    await deps.store.put(
      keys.policy(policyId, basename(path)),
      bytes,
      isPdf ? "application/pdf" : "text/markdown",
    );
    await db.insert(schema.policies).values({
      id: policyId,
      title: basename(path),
      sourceKey: keys.policy(policyId, basename(path)),
      status: "compiling",
    });
    const compiled = await compilePolicy(
      deps.client,
      policyId,
      isPdf
        ? { kind: "pdf", filename: basename(path), bytes }
        : { kind: "text", text: bytes.toString("utf8") },
    );
    await db.transaction(async (tx) => {
      if (compiled.rules.length > 0) {
        await tx.insert(schema.rules).values(
          compiled.rules.map((r) => ({
            policyId,
            id: r.id,
            text: r.text,
            type: r.type,
            status: r.status,
            clarification: r.clarification,
            params: r.params,
            sourcePage: r.sourceSpan.page,
            sourceQuote: r.sourceSpan.quote,
          })),
        );
      }
      await tx
        .update(schema.policies)
        .set({ title: compiled.title, status: "awaiting_signoff" })
        .where(eq(schema.policies.id, policyId));
    });
    await show(policyId);
  } else if (command === "resolve") {
    const [policyId, ruleId, json, readBack] = args;
    if (!policyId || !ruleId || !json)
      throw new Error("usage: policy resolve <policyId> <ruleId> '<json>' [read-back]");
    const rule = (await loadRules(db, policyId)).find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} not found in ${policyId}`);
    const resolved = resolveRule(rule, JSON.parse(json), readBack);
    await db
      .update(schema.rules)
      .set({
        params: resolved.params,
        status: resolved.status,
        clarification: null,
        text: resolved.text,
      })
      .where(and(eq(schema.rules.policyId, policyId), eq(schema.rules.id, ruleId)));
    await show(policyId);
  } else if (command === "sign-off") {
    const [policyId, operator] = args;
    if (!policyId || !operator) throw new Error("usage: policy sign-off <policyId> <operator>");
    const rules = await loadRules(db, policyId);
    const open = rules.filter((r) => r.status !== "ready");
    if (open.length > 0)
      throw new Error(`Resolve ${open.map((r) => r.id).join(", ")} before signing off.`);
    const now = new Date();
    await db
      .update(schema.rules)
      .set({ signedOffBy: operator, signedOffAt: now })
      .where(eq(schema.rules.policyId, policyId));
    await db
      .update(schema.policies)
      .set({ status: "signed_off" })
      .where(eq(schema.policies.id, policyId));
    await show(policyId);
  } else if (command === "show") {
    await show(args[0] ?? "");
  } else {
    throw new Error("usage: policy compile|resolve|sign-off|show ...");
  }
} finally {
  await deps.handle.close();
}
