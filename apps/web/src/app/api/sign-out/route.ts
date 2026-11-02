import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Sign out through Better Auth's own handler: it clears the session cookie even
 * when the session row is already gone, so a stale cookie cannot loop.
 */
export async function POST(req: Request) {
  const res = await auth().api.signOut({ headers: req.headers, asResponse: true });
  const out = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  for (const cookie of res.headers.getSetCookie()) out.headers.append("set-cookie", cookie);
  return out;
}
