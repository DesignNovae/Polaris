import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db/mongodb";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { registerSchema } from "@/lib/validation/schemas";
import type { DbUser } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  const body = registerSchema.parse(await parseJson(req));
  const { name, email, password, role } = body;

  const db = await getDb();
  const existing = await db
    .collection("users")
    .findOne({ email: email.toLowerCase() });

  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const hashed = await bcrypt.hash(password, 10);

  const user: DbUser = {
    name,
    email: email.toLowerCase(),
    password: hashed,
    role: role ?? "student",
    plan: "free",
    createdAt: new Date(),
  };

  await db.collection<DbUser>("users").insertOne(user);

  return ok({ ok: true }, 201);
});
