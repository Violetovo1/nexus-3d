import { NextResponse } from "next/server";

import {
  setOperatorSession,
  verifyOperatorPassword,
} from "@/lib/operator-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };

    if (!body.password || !verifyOperatorPassword(body.password)) {
      return NextResponse.json(
        { error: "管理密码错误" },
        { status: 401 },
      );
    }

    await setOperatorSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "登录时发生未知错误",
      },
      { status: 500 },
    );
  }
}
