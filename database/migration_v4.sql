-- =====================================================================
-- migration_v4.sql : notifications for live chat (Task 25) and
--   Featured Resolved Cases for the landing page (Task 28, at the end).
--   When a staff member replies to a message a resident left outside the
--   Chat Schedule, the resident gets a notification that belongs to the
--   chat (not to a report). So a notification now belongs to EITHER:
--     - a report       (report_id set, chat_session_id NULL)  - as before
--     - a chat session (chat_session_id set, report_id NULL)  - new
--
-- Safe to run on the existing database: all current notifications keep
-- their report; running it a second time does not cause errors.
-- Run migration_v3.sql first. Import in phpMyAdmin or: mysql -u root < migration_v4.sql
-- =====================================================================

USE landayan_ers;

ALTER TABLE notification
  MODIFY report_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS chat_session_id INT UNSIGNED NULL AFTER report_id,
  ADD INDEX IF NOT EXISTS idx_notification_chat (chat_session_id);

ALTER TABLE notification
  ADD CONSTRAINT fk_notification_chat FOREIGN KEY IF NOT EXISTS (chat_session_id)
    REFERENCES chat_session (session_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- Featured Resolved Cases (Task 28): resolved reports the LGU shows in
-- the public landing page slideshow, with an LGU caption and an "after"
-- photo (stored in server/uploads/featured/). The resident's own photos
-- and personal data are never shown publicly.
--   report_id is UNIQUE: a report can be featured only once.
--   is_visible: the LGU can hide a case; the server also hides it
--               automatically if its report is no longer Resolved.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS featured_case (
  featured_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id        INT UNSIGNED NOT NULL,
  caption          VARCHAR(200) NOT NULL,
  after_photo_path VARCHAR(255) NOT NULL,
  display_order    INT NOT NULL DEFAULT 0,
  is_visible       BOOLEAN NOT NULL DEFAULT TRUE,
  date_featured    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lgu_id           INT UNSIGNED NOT NULL,
  PRIMARY KEY (featured_id),
  UNIQUE KEY uq_featured_report (report_id),
  KEY idx_featured_order (is_visible, display_order),
  CONSTRAINT fk_featured_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_featured_lgu FOREIGN KEY (lgu_id)
    REFERENCES lgu (lgu_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
