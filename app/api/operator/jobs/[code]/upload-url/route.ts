import { NextResponse } from "next/server";

import { sanitizeFileName } from "@/lib/files";
import { isOperatorAuthenticated } from "@/lib/operator-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_MODEL_SIZE = 50 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ code: string }>;
};

type UploadBody = {
  fileName?: string;
  fileSize?: number;
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
    const body = (await request.json()) as UploadBody;
    const fileName = body.fileName?.trim();
    const fileSize = Number(body.fileSize);

    if (!fileName || !fileName.toLowerCase().endsWith(".glb")) {
      return NextResponse.json(
        { error: "请选择 GLB 模型文件" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_MODEL_SIZE) {
      return NextResponse.json(
        { error: "模型文件必须在 50MB 以内" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: existingJob, error: jobError } = await supabase
      .from("jobs")
      .select("code")
      .eq("code", code)
      .single();

    if (jobError || !existingJob) {
      return NextResponse.json(
        { error: "未找到该任务" },
        { status: 404 },
      );
    }

    const modelPath = `${code}/${Date.now()}-${sanitizeFileName(fileName)}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("job-models")
      .createSignedUploadUrl(modelPath, { upsert: false });

    if (uploadError || !uploadData?.token) {
      return NextResponse.json(
        {
          error:
            uploadError?.message || "无法创建模型上传地址，请检查存储桶",
        },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "model_uploading",
        model_name: fileName,
        updated_at: new Date().toISOString(),
      })
      .eq("code", code);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      upload: {
        bucket: "job-models",
        path: modelPath,
        token: uploadData.token,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "申请模型上传地址失败",
      },
      { status: 500 },
    );
  }
}
