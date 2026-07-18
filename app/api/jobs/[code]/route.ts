import { NextResponse } from "next/server";

import {
  getPublicStorageUrl,
  getSupabaseAdmin,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: job, error } = await supabase
      .from("jobs")
      .select(
        "code,status,image_path,image_name,model_path,model_name,progress,created_at,model_ready_at,completed_at,updated_at",
      )
      .eq("code", code)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: "未找到该任务" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ...job,
        image_url: getPublicStorageUrl("job-images", job.image_path),
        model_url: getPublicStorageUrl("job-models", job.model_path),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "查询任务时发生未知错误",
      },
      { status: 500 },
    );
  }
}
