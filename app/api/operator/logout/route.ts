import { NextResponse } from "next/server";

import { clearOperatorSession } from "@/lib/operator-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearOperatorSession();
  return NextResponse.json({ ok: true });
}
