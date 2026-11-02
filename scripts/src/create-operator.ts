/**
 * Create the operator account for the web app. Asks for the password on the
 * terminal and never prints or stores it anywhere but its hash.
 *   pnpm create-operator <email> "<name>"
 */
import { createInterface } from "node:readline/promises";
import { createAuth, createOperator } from "@blackbox/auth";
import { connect } from "@blackbox/db";
import { loadEnv } from "./env.ts";

loadEnv();
const [email, name] = process.argv.slice(2);
if (!email || !name) throw new Error('usage: create-operator <email> "<name>"');
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const password = await rl.question("Password (12+ characters): ");
rl.close();
const { db, close } = connect();
try {
  const id = await createOperator(createAuth(db, { secret: process.env.BETTER_AUTH_SECRET }), {
    email,
    name,
    password,
  });
  console.log(`Created operator ${email} (${id}).`);
} finally {
  await close();
}
