-- =====================================================================
-- migration_v6.sql : Data Privacy consent and logout that ends the session
--   (Task 32).
--   resident.consent_date  - when the resident agreed to the Data Privacy
--                            Notice (RA 10173) while registering. NULL for
--                            accounts made before this change.
--   <account>.token_version - every login token carries this number; logout
--                            and password change raise it, so older tokens
--                            stop working (REST API and Socket.IO).
--
-- Safe to run on the existing database; running it twice does not cause errors.
-- Everyone has to log in again once after this migration (old tokens have no version).
-- Run migration_v5.sql first. Import in phpMyAdmin or: mysql -u root < migration_v6.sql
-- =====================================================================

USE landayan_ers;

ALTER TABLE resident
  ADD COLUMN IF NOT EXISTS consent_date DATETIME NULL AFTER account_status,
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

ALTER TABLE response_team
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

ALTER TABLE lgu
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
