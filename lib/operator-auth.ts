import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "yj_operator_session";
const SESSION_MESSAGE = "AI3D_YUEJING_OPERATOR_SESSION_V1";

function getPassword() {
  const password = process.env.OPERATOR_PASSWORD;

  if (!password) {
    throw new Error("缺少 OPERATOR_PASSWORD 环境变量");
  }

  return password;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

function createSessionToken() {
  return crypto
    .createHmac("sha256", getPassword())
    .update(SESSION_MESSAGE)
    .digest("hex");
}

export function verifyOperatorPassword(input: string) {
  return crypto.timingSafeEqual(sha256(input), sha256(getPassword()));
}

export async function setOperatorSession() {
  const store = await cookies();

  store.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearOperatorSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isOperatorAuthenticated() {
  const store = await cookies();
  const actual = store.get(COOKIE_NAME)?.value;

  if (!actual) return false;

  const expected = createSessionToken();

  try {
    return crypto.timingSafeEqual(
      Buffer.from(actual, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}
