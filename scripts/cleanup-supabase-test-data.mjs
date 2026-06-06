#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const url = process.env.SUPABASE_URL || process.env.SOUPZ_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL/SOUPZ_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const client = createClient(url, serviceKey, { auth: { persistSession: false } });

const patterns = [
  'radiator routes',
  'hackathon ps',
  'radtor routes',
  'sitepilot',
  'focusflow',
  'gitslane',
  'kachow',
  'ruzt-eze',
];

function containsAny(text = '') {
  const lower = String(text || '').toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

async function fetchRows(table, columns, limit = 2000) {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function main() {
  const orders = await fetchRows('soupz_orders', 'id,prompt,created_at,status', 3000);
  const commands = await fetchRows('soupz_commands', 'id,payload,created_at,type,status', 3000);
  const responses = await fetchRows('soupz_responses', 'id,result,created_at,type,status', 3000);

  const orderIds = orders.filter((r) => containsAny(r.prompt)).map((r) => r.id);
  const commandIds = commands.filter((r) => containsAny(JSON.stringify(r.payload))).map((r) => r.id);
  const responseIds = responses.filter((r) => containsAny(JSON.stringify(r.result))).map((r) => r.id);

  console.log('Dry run summary:');
  console.log(`- soupz_orders matches: ${orderIds.length}`);
  console.log(`- soupz_commands matches: ${commandIds.length}`);
  console.log(`- soupz_responses matches: ${responseIds.length}`);

  if (!apply) {
    console.log('No deletes executed. Run with --apply to delete matching rows.');
    return;
  }

  if (responseIds.length > 0) {
    const { error } = await client.from('soupz_responses').delete().in('id', responseIds);
    if (error) throw new Error(`Delete soupz_responses failed: ${error.message}`);
  }

  if (commandIds.length > 0) {
    const { error } = await client.from('soupz_commands').delete().in('id', commandIds);
    if (error) throw new Error(`Delete soupz_commands failed: ${error.message}`);
  }

  if (orderIds.length > 0) {
    const { error } = await client.from('soupz_orders').delete().in('id', orderIds);
    if (error) throw new Error(`Delete soupz_orders failed: ${error.message}`);
  }

  console.log('Delete complete.');
}

main().catch((err) => {
  console.error(`Cleanup failed: ${err.message}`);
  process.exit(1);
});
