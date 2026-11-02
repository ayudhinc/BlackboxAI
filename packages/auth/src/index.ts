/**
 * Better Auth for BlackboxAI: one operator signs in with email and password;
 * public sign-up is disabled, so hosted credits cannot be spent by strangers.
 */
import { type Db, schema } from "@blackbox/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth(
  db: Db,
  options: { secret?: string; baseURL?: string; plugins?: unknown[] } = {},
) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    ...(options.secret ? { secret: options.secret } : {}),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    // biome-ignore lint/suspicious/noExplicitAny: plugin types differ by host (Next.js cookies plugin)
    plugins: (options.plugins ?? []) as any[],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Create the operator account. Sign-up is disabled, so this is the only way in. */
export async function createOperator(
  auth: Auth,
  input: { email: string; name: string; password: string },
): Promise<string> {
  const ctx = await auth.$context;
  if (input.password.length < 12) throw new Error("Use a password of at least 12 characters.");
  if (await ctx.internalAdapter.findUserByEmail(input.email))
    throw new Error(`An account for ${input.email} already exists.`);
  const user = await ctx.internalAdapter.createUser(
    { email: input.email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(input.password),
  });
  return user.id;
}
