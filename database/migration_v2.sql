-- =====================================================================
-- migration_v2.sql : upgrades an EXISTING landayan_ers database to v2.
--   - report: area, priority, similar_to_report_id (+ indexes, foreign key)
--   - new table report_photo
--   - fills the new columns for existing reports
--   - applies the v2 rule: every report past "Submitted" has a team
--
-- Safe to run on the existing database: it keeps all current data, and
-- running it a second time does not cause errors or duplicate anything.
-- Import it in phpMyAdmin (Import tab) or run: mysql -u root < migration_v2.sql
-- (A brand-new install does not need this file: import schema.sql + seed.sql.)
-- The numbers 3 / 7 below are SIMILAR_DAYS, PRIORITY_RAISE_DAYS and
-- PRIORITY_RAISE_COUNT from server/config/rules.js.
-- =====================================================================

USE landayan_ers;

-- ---------------------------------------------------------------------
-- 1. New columns on report.
--    area is added without a default; existing rows get '' for a moment
--    and are filled in step 3.
-- ---------------------------------------------------------------------
ALTER TABLE report
  ADD COLUMN IF NOT EXISTS area VARCHAR(50) NOT NULL AFTER issue_type,
  ADD COLUMN IF NOT EXISTS priority ENUM('High','Medium','Low') NOT NULL DEFAULT 'Low' AFTER area,
  ADD COLUMN IF NOT EXISTS similar_to_report_id INT UNSIGNED NULL AFTER priority;

ALTER TABLE report
  ADD INDEX IF NOT EXISTS idx_report_priority (priority),
  ADD INDEX IF NOT EXISTS idx_report_area_rules (area, issue_type, date_submitted);

-- similar_to_report_id points to another report (NULL if that report is deleted).
ALTER TABLE report
  ADD CONSTRAINT fk_report_similar FOREIGN KEY IF NOT EXISTS (similar_to_report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 2. New table for report photos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_photo (
  photo_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id     INT UNSIGNED NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  date_uploaded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id),
  KEY idx_photo_report (report_id),
  CONSTRAINT fk_photo_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Fill in the area of existing reports from their location text
--    (only rows that do not have an area yet):
--      "... Purok 3 ..."                          -> Purok 3
--      "Landayan Road, near the tricycle terminal" -> Purok 7
--      other "Landayan Road ..." locations         -> Purok 6
--      anything else                               -> Purok 1 (edit later if needed)
-- ---------------------------------------------------------------------
UPDATE report
SET area = CASE
    WHEN location REGEXP '[Pp]urok [1-7]'
      THEN CONCAT('Purok ', RIGHT(REGEXP_SUBSTR(location, '[Pp]urok [1-7]'), 1))
    WHEN location LIKE '%Landayan Road%tricycle terminal%' THEN 'Purok 7'
    WHEN location LIKE '%Landayan Road%' THEN 'Purok 6'
    ELSE 'Purok 1'
  END
WHERE area = '';

-- ---------------------------------------------------------------------
-- 4. Response team areas must use the area names. Only the original sample
--    values are changed; areas you already edited are left alone.
-- ---------------------------------------------------------------------
UPDATE response_team SET assigned_area = 'Purok 4, Purok 5, Purok 6, Purok 7'
WHERE username = 'team2' AND assigned_area = 'Purok 4, Purok 5, Landayan Road';

-- ---------------------------------------------------------------------
-- 5. v2 rule: a team is assigned from "Under Review" on.
--    Reports past Submitted that have no team get the team whose
--    assigned_area includes the report's area (or the first team if none does).
--    Submitted reports are not assigned yet.
-- ---------------------------------------------------------------------
UPDATE report r
JOIN response_team t ON FIND_IN_SET(r.area, REPLACE(t.assigned_area, ', ', ',')) > 0
SET r.team_id = t.team_id
WHERE r.team_id IS NULL AND r.status <> 'Submitted';

UPDATE report
SET team_id = (SELECT MIN(team_id) FROM response_team)
WHERE team_id IS NULL AND status <> 'Submitted';

UPDATE report SET team_id = NULL WHERE status = 'Submitted' AND team_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Priority, using the same rule as new reports (server/config/rules.js):
--    count the reports with the same issue type in the same area submitted
--    within the 7 days up to and including this report (PRIORITY_RAISE_DAYS).
--      3 or more (PRIORITY_RAISE_COUNT) -> High, 2 -> Medium, 1 -> Low
-- ---------------------------------------------------------------------
UPDATE report r
JOIN (
  SELECT a.report_id, COUNT(*) AS recent
  FROM report a
  JOIN report b
    ON b.area = a.area
   AND b.issue_type = a.issue_type
   AND b.date_submitted >= a.date_submitted - INTERVAL 7 DAY
   AND (b.date_submitted < a.date_submitted
        OR (b.date_submitted = a.date_submitted AND b.report_id <= a.report_id))
  GROUP BY a.report_id
) counts ON counts.report_id = r.report_id
SET r.priority = CASE
    WHEN counts.recent >= 3 THEN 'High'
    WHEN counts.recent >= 2 THEN 'Medium'
    ELSE 'Low'
  END;

-- ---------------------------------------------------------------------
-- 7. Similar reports (SIMILAR_DAYS = 3): link each report to the most recent
--    earlier report with the same issue type in the same area within 3 days.
-- ---------------------------------------------------------------------
UPDATE report r
JOIN (
  SELECT a.report_id,
         (SELECT b.report_id
          FROM report b
          WHERE b.area = a.area
            AND b.issue_type = a.issue_type
            AND b.date_submitted >= a.date_submitted - INTERVAL 3 DAY
            AND (b.date_submitted < a.date_submitted
                 OR (b.date_submitted = a.date_submitted AND b.report_id < a.report_id))
          ORDER BY b.date_submitted DESC, b.report_id DESC
          LIMIT 1) AS similar_id
  FROM report a
) links ON links.report_id = r.report_id
SET r.similar_to_report_id = links.similar_id;

-- ---------------------------------------------------------------------
-- 8. Remove the temporary empty default: new reports must always give an area.
-- ---------------------------------------------------------------------
ALTER TABLE report MODIFY area VARCHAR(50) NOT NULL;
