-- 在 Supabase SQL Editor 运行，用于检查 jobs 表是否存在。
select
  code,
  status,
  image_name,
  model_name,
  created_at,
  model_ready_at
from public.jobs
order by created_at desc
limit 20;
