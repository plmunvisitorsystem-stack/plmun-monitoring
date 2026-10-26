-- =====================================================================
-- migration_v5.sql : notifications for LGU and response team accounts
--   (Task 30: the bell in the staff top bar).
--   Resident notifications stay in the notification table; staff get
--   their own table because each row has ONE staff account as recipient.
--   The message is NOT stored as text: the client builds it in English
--   or Tagalog from type + report + detail.
--     type new_report      -> every LGU account     (detail NULL)
--     type assigned        -> the response team     (detail NULL)
--     type status_changed  -> every LGU account     (detail = new status)
--     type message_left    -> every LGU and team    (detail NULL, chat_session_id set)
--
-- Safe to run on the existing database; running it twice does not cause errors.
-- Run migration_v4.sql first. Import in phpMyAdmin or: mysql -u root < migration_v5.sql
-- (The Chat Schedule page uses the existing chat_schedule table; no change needed.)
-- =====================================================================

USE landayan_ers;

CREATE TABLE IF NOT EXISTS staff_notification (
  staff_notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_role  ENUM('lgu','response_team') NOT NULL,
  recipient_id    INT UNSIGNED NOT NULL,     -- lgu_id or team_id (no foreign key: either table)
  type            ENUM('new_report','assigned','status_changed','message_left') NOT NULL,
  report_id       INT UNSIGNED NULL,
  chat_session_id INT UNSIGNED NULL,
  detail          VARCHAR(50) NULL,
  date_sent       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('Unread','Read') NOT NULL DEFAULT 'Unread',
  PRIMARY KEY (staff_notification_id),
  KEY idx_staff_notification_recipient (recipient_role, recipient_id, status),
  CONSTRAINT fk_staff_notification_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_staff_notification_chat FOREIGN KEY (chat_session_id)
    REFERENCES chat_session (session_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
