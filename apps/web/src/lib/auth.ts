import "server-only";
import { createAuth } from "@blackbox/auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "./server";

const g = globalThis as unknown as { __bbAuth?: ReturnType<typeof createAuth> };

export function auth() {
  g.__bbAuth ??= createAuth(db(), {
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [nextCookies()],
  });
  return g.__bbAuth;
}

export type Operator = { id: string; name: string; email: string };

/** The signed-in operator, validated against the session table, or null. */
export async function currentOperator(): Promise<Operator | null> {
  const s = await auth().api.getSession({ headers: await headers() });
  return s ? { id: s.user.id, name: s.user.name, email: s.user.email } : null;
}

/** For pages and server actions: the operator, or a redirect to sign-in. */
export async function requireOperator(): Promise<Operator> {
  const op = await currentOperator();
  if (!op) redirect("/login");
  return op;
}

/** For API routes: the operator, or a 401 response to return as is. */
export async function operatorOr401(): Promise<Operator | NextResponse> {
  const op = await currentOperator();
  return op ?? NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
}
