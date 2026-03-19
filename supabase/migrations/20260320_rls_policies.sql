-- Enable RLS on all soupz_ tables
ALTER TABLE IF EXISTS soupz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS soupz_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS soupz_output_chunks ENABLE ROW LEVEL SECURITY;

-- soupz_orders: allow daemon (service role) + public for now
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_orders' AND policyname='orders_public_read') THEN
    CREATE POLICY "orders_public_read" ON soupz_orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_orders' AND policyname='orders_public_insert') THEN
    CREATE POLICY "orders_public_insert" ON soupz_orders FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_orders' AND policyname='orders_public_update') THEN
    CREATE POLICY "orders_public_update" ON soupz_orders FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_machines' AND policyname='machines_public_read') THEN
    CREATE POLICY "machines_public_read" ON soupz_machines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_machines' AND policyname='machines_public_insert') THEN
    CREATE POLICY "machines_public_insert" ON soupz_machines FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_machines' AND policyname='machines_public_update') THEN
    CREATE POLICY "machines_public_update" ON soupz_machines FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_output_chunks' AND policyname='output_public_read') THEN
    CREATE POLICY "output_public_read" ON soupz_output_chunks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soupz_output_chunks' AND policyname='output_public_insert') THEN
    CREATE POLICY "output_public_insert" ON soupz_output_chunks FOR INSERT WITH CHECK (true);
  END IF;
END $$;
