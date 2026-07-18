import "server-only";

import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量");
  }

  if (!key) {
    throw new Error(
      "缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 环境变量",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getPublicStorageUrl(bucket: string, path?: string | null) {
  if (!path) return null;

  const supabase = getSupabaseAdmin();
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
