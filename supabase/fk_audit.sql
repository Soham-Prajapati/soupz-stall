-- Foreign key audit helpers for Supabase/Postgres

-- List all foreign keys in public schema
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints as tc
join information_schema.key_column_usage as kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage as ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- Candidate columns that look like references but do not have FK constraints
with fk_columns as (
  select kcu.table_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
)
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
left join fk_columns fk
  on fk.table_name = c.table_name and fk.column_name = c.column_name
where c.table_schema = 'public'
  and fk.column_name is null
  and (
    c.column_name ilike '%_id'
    or c.column_name ilike 'id_%'
  )
order by c.table_name, c.column_name;
