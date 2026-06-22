-- JZ_VAPE Multi-Location Database Migration
-- Run this script in your Supabase SQL Editor

-- ================================================
-- STEP 1: Create locations table
-- ================================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON locations;
DROP POLICY IF EXISTS "Allow authenticated insert" ON locations;
DROP POLICY IF EXISTS "Allow authenticated update" ON locations;
DROP POLICY IF EXISTS "Allow authenticated delete" ON locations;

-- Create policies
CREATE POLICY "Allow public read access" ON locations
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON locations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON locations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON locations
  FOR DELETE USING (auth.role() = 'authenticated');

-- ================================================
-- STEP 2: Add location_id to customers table
-- ================================================

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN location_id UUID REFERENCES locations(id);
  END IF;
END $$;

-- ================================================
-- STEP 3: Add location_id to inventory table
-- ================================================

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE inventory ADD COLUMN location_id UUID REFERENCES locations(id);
  END IF;
END $$;

-- ================================================
-- STEP 4: Create initial locations (OPTIONAL)
-- ================================================

-- Uncomment the lines below to create sample locations
-- INSERT INTO locations (name) VALUES 
--   ('PPC'),
--   ('El Nido'),
--   ('Main Store')
-- ON CONFLICT DO NOTHING;

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check if locations table was created
SELECT 'locations table' AS check_name, 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations') AS exists;

-- Check if location_id was added to customers
SELECT 'customers.location_id' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'customers' AND column_name = 'location_id'
       ) AS exists;

-- Check if location_id was added to inventory
SELECT 'inventory.location_id' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'inventory' AND column_name = 'location_id'
       ) AS exists;

-- ================================================
-- OPTIONAL: Data Migration for Existing Records
-- ================================================

-- If you have existing customers and inventory, you can assign them to a default location
-- First, create a default location if needed:

-- INSERT INTO locations (name) VALUES ('Default Location') 
-- ON CONFLICT DO NOTHING;

-- Then update existing records:
-- UPDATE customers SET location_id = (SELECT id FROM locations WHERE name = 'Default Location' LIMIT 1)
-- WHERE location_id IS NULL;

-- UPDATE inventory SET location_id = (SELECT id FROM locations WHERE name = 'Default Location' LIMIT 1)
-- WHERE location_id IS NULL;

-- ================================================
-- SUCCESS!
-- ================================================

SELECT 'Migration completed successfully!' AS status;
