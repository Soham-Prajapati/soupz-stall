-- Data retention and orphan checks for Soupz core tables
-- Run in Supabase SQL editor before and after cleanup jobs.

-- 1) Retention windows (expected policy)
-- soupz_responses: 1 hour
-- soupz_commands:  1 hour (done/error)
-- soupz_orders:    7 days

select
  'soupz_responses_older_than_1h' as check_name,
  count(*) as row_count
from public.soupz_responses
where created_at < now() - interval '1 hour';

select
  'soupz_commands_older_than_1h_done_error' as check_name,
  count(*) as row_count
from public.soupz_commands
where created_at < now() - interval '1 hour'
  and status in ('done', 'error');

select
  'soupz_orders_older_than_7d' as check_name,
  count(*) as row_count
from public.soupz_orders
where created_at < now() - interval '7 days';

-- 2) Retention drift by status/source
select status, count(*) as count_rows
from public.soupz_orders
where created_at < now() - interval '7 days'
group by status
order by count_rows desc;

select status, count(*) as count_rows
from public.soupz_commands
where created_at < now() - interval '1 hour'
group by status
order by count_rows desc;

-- 3) Referential orphan checks
select
  'orphan_orders_user_id' as check_name,
  count(*) as row_count
from public.soupz_orders o
left join auth.users u on u.id = o.user_id
where o.user_id is not null and u.id is null;

select
  'orphan_machines_user_id' as check_name,
  count(*) as row_count
from public.soupz_machines m
left join auth.users u on u.id = m.user_id
where m.user_id is not null and u.id is null;

select
  'orphan_orders_machine_id' as check_name,
  count(*) as row_count
from public.soupz_orders o
left join public.soupz_machines m on m.id = o.machine_id
where o.machine_id is not null and m.id is null;

select
  'orphan_shadow_manifest_machine_id' as check_name,
  count(*) as row_count
from public.soupz_shadow_manifest sm
left join public.soupz_machines m on m.id = sm.machine_id
where sm.machine_id is not null and m.id is null;

-- 4) Optional sample rows for manual cleanup review
-- select * from public.soupz_orders where created_at < now() - interval '7 days' limit 50;
-- select * from public.soupz_commands where created_at < now() - interval '1 hour' and status in ('done', 'error') limit 50;
-- select * from public.soupz_responses where created_at < now() - interval '1 hour' limit 50;
