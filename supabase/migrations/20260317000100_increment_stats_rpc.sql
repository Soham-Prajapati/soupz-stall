create or replace function increment_platform_stats(
  p_tokens_used bigint default 0,
  p_tokens_saved bigint default 0,
  p_lines_generated bigint default 0,
  p_success boolean default true
) returns void
language plpgsql
security definer
as $$
begin
  update public.soupz_platform_stats
  set
    total_orders = total_orders + 1,
    total_tokens_used = total_tokens_used + p_tokens_used,
    total_tokens_saved = total_tokens_saved + p_tokens_saved,
    total_lines_generated = total_lines_generated 
      + p_lines_generated,
    updated_at = now()
  where id = 1;
end;
$$;
