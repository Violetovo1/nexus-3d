import { NextResponse } from "next/server";

import { isOperatorAuthenticated } from "@/lib/operator-auth";
import {
  getPublicStorageUrl,
  getSupabaseAdmin,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isOperatorAuthenticated())) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(
        "code,status,image_path,image_name,model_path,model_name,progress,created_at,model_ready_at,completed_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        jobs: (jobs || []).map((job) => ({
          ...job,
          image_url: getPublicStorageUrl("job-images", job.image_path),
          model_url: getPublicStorageUrl("job-models", job.model_path),
        })),
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
          error instanceof Error ? error.message : "读取任务列表失败",
      },
      { status: 500 },
    );
  }
}
