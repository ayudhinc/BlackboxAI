/** The compile_policy job: compile a stored policy document and save its rules for sign-off. */
import { extname } from "node:path";
import { type Db, schema } from "@blackbox/db";
import { eq } from "drizzle-orm";
import type { MetaClient } from "../meta/client.ts";
import { saveRules } from "../pipeline/repo.ts";
import { compilePolicy } from "../policy/compile.ts";
import type { BlobStore } from "../store/blob.ts";

export async function runCompilePolicy(
  db: Db,
  client: MetaClient,
  store: BlobStore,
  policyId: string,
): Promise<void> {
  const policy = await db.query.policies.findFirst({ where: eq(schema.policies.id, policyId) });
  if (!policy?.sourceKey) throw new Error(`Policy ${policyId} has no source document`);
  try {
    const bytes = await store.get(policy.sourceKey);
    const filename = policy.sourceKey.split("/").at(-1) ?? "policy.pdf";
    const compiled = await compilePolicy(
      client,
      policyId,
      extname(filename).toLowerCase() === ".pdf"
        ? { kind: "pdf", filename, bytes }
        : { kind: "text", text: bytes.toString("utf8") },
    );
    await db.delete(schema.rules).where(eq(schema.rules.policyId, policyId));
    await saveRules(db, compiled.rules);
    await db
      .update(schema.policies)
      .set({ title: compiled.title || policy.title, status: "awaiting_signoff" })
      .where(eq(schema.policies.id, policyId));
  } catch (error) {
    await db
      .update(schema.policies)
      .set({ status: "failed" })
      .where(eq(schema.policies.id, policyId));
    throw error;
  }
}
