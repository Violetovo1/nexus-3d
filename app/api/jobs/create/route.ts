import { NextResponse } from "next/server";

import { createJobCode, sanitizeFileName } from "@/lib/files";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type CreateJobBody = {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateJobBody;
    const fileName = body.fileName?.trim();
    const fileType = body.fileType?.trim();
    const fileSize = Number(body.fileSize);

    if (!fileName || !fileType || !Number.isFinite(fileSize)) {
      return NextResponse.json(
        { error: "图片参数不完整" },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: "仅支持 JPG、PNG、WEBP 图片" },
        { status: 400 },
      );
    }

    if (fileSize <= 0 || fileSize > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "图片大小必须在 20MB 以内" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createJobCode();
      const safeName = sanitizeFileName(fileName);
      const imagePath = `${code}/${Date.now()}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("job-images")
        .createSignedUploadUrl(imagePath);

      if (uploadError || !uploadData?.token) {
        return NextResponse.json(
          {
            error:
              uploadError?.message || "无法创建图片上传地址，请检查存储桶",
          },
          { status: 500 },
        );
      }

      const { data: job, error: insertError } = await supabase
        .from("jobs")
        .insert({
          code,
          status: "processing",
          image_path: imagePath,
          image_name: fileName,
          progress: 0,
          updated_at: new Date().toISOString(),
        })
        .select(
          "code,status,image_path,image_name,created_at,updated_at",
        )
        .single();

      if (!insertError && job) {
        return NextResponse.json({
          job,
          upload: {
            bucket: "job-images",
            path: imagePath,
            token: uploadData.token,
          },
        });
      }

      if (insertError?.code !== "23505") {
        return NextResponse.json(
          { error: insertError?.message || "创建任务失败" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "任务编号生成失败，请重试" },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "创建任务时发生未知错误",
      },
      { status: 500 },
    );
  }
}
