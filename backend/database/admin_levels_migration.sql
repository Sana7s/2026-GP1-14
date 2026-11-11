-- =====================================================================
-- BurnCare — admin_levels_migration.sql
-- ---------------------------------------------------------------------
-- Run this ONCE on a database that already has the tables (pgAdmin →
-- burncare → Query Tool → open this file → F5). It keeps all your data.
--
-- What it does: adds the admin level, so there can be several admins.
--   'super' = reviews staff AND can add / deactivate admins
--   'admin' = reviews staff only
-- Every admin that already exists becomes a super admin, so nobody loses
-- access. A new database made with schema.sql already has this column.
-- =====================================================================

ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS admin_level VARCHAR(10) NOT NULL DEFAULT 'admin';

ALTER TABLE admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_admin_level_check;
ALTER TABLE admin_profiles
  ADD CONSTRAINT admin_profiles_admin_level_check CHECK (admin_level IN ('super', 'admin'));

UPDATE admin_profiles SET admin_level = 'super';
