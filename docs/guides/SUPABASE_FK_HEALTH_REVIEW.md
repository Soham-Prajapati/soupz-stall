# Supabase Foreign Key Health Review

Date: 2026-04-02
Scope: static review of `supabase/schema.sql` and `supabase/migrations/*.sql`.

## Summary

- Commands/responses tables already have strong FK coverage.
- Relay/order path had referential gaps around `user_id` and `machine_id` relationships.
- Added migration `supabase/migrations/20260402000100_fk_hardening.sql` to harden coverage safely.

## Findings

1. Good coverage already present:
- `soupz_commands.user_id -> auth.users(id)`
- `soupz_responses.command_id -> soupz_commands(id)`
- `soupz_responses.user_id -> auth.users(id)`
- `soupz_output_chunks.order_id -> soupz_orders(id)`

2. Gaps found before this review:
- `soupz_machines.user_id` had no FK to `auth.users(id)`.
- `soupz_orders.user_id` had no FK to `auth.users(id)`.
- `soupz_orders.machine_id` had no FK to `soupz_machines(id)`.
- `soupz_shadow_manifest.machine_id` had no FK to `soupz_machines(id)`.

## Changes Introduced

Migration: `supabase/migrations/20260402000100_fk_hardening.sql`

- Adds supporting indexes:
  - `idx_soupz_orders_user_id`
  - `idx_soupz_orders_machine_id`
  - `idx_soupz_machines_user_id`
  - `idx_soupz_shadow_manifest_machine_id`

- Adds NOT VALID constraints to avoid deploy failure on legacy rows:
  - `soupz_machines_user_id_fkey`
  - `soupz_orders_user_id_fkey`
  - `soupz_orders_machine_id_fkey`
  - `soupz_shadow_manifest_machine_id_fkey`

## Validation Plan

1. Run orphan checks in SQL editor:
- orders with user_id not in auth.users
- machines with user_id not in auth.users
- orders with machine_id not in soupz_machines
- shadow_manifest rows with missing machine_id reference

2. Cleanup any orphaned rows.

3. Validate constraints:
- `alter table ... validate constraint ...`

## Notes

- This review is static (repo SQL) and not a live production DB inspection.
- For live environments, use `supabase/fk_audit.sql` plus row-count and orphan diagnostics before validation.
