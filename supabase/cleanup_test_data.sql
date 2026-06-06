-- Supabase test-data cleanup playbook
-- Run manually in Supabase SQL editor after reviewing row counts.
-- This is intentionally not auto-executed by migrations.

-- 1) Dry-run counts (edit patterns as needed)
select 'soupz_orders' as table_name, count(*)
from public.soupz_orders
where prompt ilike any (array[
  '%radiator routes%',
  '%hackathon ps%',
  '%test%',
  '%dummy%'
]);

select 'soupz_commands' as table_name, count(*)
from public.soupz_commands
where type ilike any (array['%test%'])
   or payload::text ilike any (array['%radiator routes%', '%hackathon%']);

select 'soupz_responses' as table_name, count(*)
from public.soupz_responses
where result::text ilike any (array['%radiator routes%', '%hackathon%', '%dummy%']);

-- 2) Optional time-scoped cleanup (recommended)
-- Un-comment after confirming counts.

-- delete from public.soupz_responses
-- where created_at > now() - interval '14 days'
--   and result::text ilike any (array['%radiator routes%', '%hackathon%', '%dummy%']);

-- delete from public.soupz_commands
-- where created_at > now() - interval '14 days'
--   and (type ilike any (array['%test%'])
--     or payload::text ilike any (array['%radiator routes%', '%hackathon%']));

-- delete from public.soupz_orders
-- where created_at > now() - interval '14 days'
--   and prompt ilike any (array['%radiator routes%', '%hackathon ps%', '%test%', '%dummy%']);

-- 3) Post-cleanup verification
-- select count(*) from public.soupz_orders;
-- select count(*) from public.soupz_commands;
-- select count(*) from public.soupz_responses;
