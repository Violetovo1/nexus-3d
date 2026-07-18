import path from "node:path";
import { NextResponse } from "next/server";

import { isOperatorAuthenticated } from "@/lib/operator-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type CompleteBody = {
  modelPath?: string;
  modelName?: string;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!(await isOperatorAuthenticated())) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { code } = await context.params;
    const body = (await request.json()) as CompleteBody;
    const modelPath = body.modelPath?.trim();
    const modelName = body.modelName?.trim();

    if (!modelPath || !modelPath.startsWith(`${code}/`)) {
      return NextResponse.json(
        { error: "模型路径不合法" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const folder = path.posix.dirname(modelPath);
    const fileName = path.posix.basename(modelPath);

    const { data: files, error: listError } = await supabase.storage
      .from("job-models")
      .list(folder, {
        search: fileName,
        limit: 10,
      });

    if (listError || !files?.some((file) => file.name === fileName)) {
      return NextResponse.json(
        { error: "未检测到已上传的 GLB 文件" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data: job, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "ready",
        model_path: modelPath,
        model_name: modelName || fileName,
        progress: 100,
        model_ready_at: now,
        updated_at: now,
      })
      .eq("code", code)
      .select("code,status,model_path,model_name,model_ready_at")
      .single();

    if (updateError || !job) {
      return NextResponse.json(
        { error: updateError?.message || "更新任务失败" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "完成任务时发生未知错误",
      },
      { status: 500 },
    );
  }
}
