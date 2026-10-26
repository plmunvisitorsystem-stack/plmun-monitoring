-- =====================================================================
-- migration_v3.sql : Help and Support (chatbot + live chat).
--   - response_team, lgu: chat_availability ('Available' / 'Away')
--   - new tables chat_session, chat_message, chat_schedule
--   - default Chat Schedule: Monday-Friday 8:00 AM - 5:00 PM (Asia/Manila);
--     Saturday and Sunday closed
--
-- Safe to run on the existing database: it keeps all current data, and
-- running it a second time does not cause errors or duplicate anything.
-- Import it in phpMyAdmin (Import tab) or run: mysql -u root < migration_v3.sql
-- Run migration_v2.sql first if your database is older than v2.
--
-- Note: no CHECK constraints are used (MariaDB 10.4 in XAMPP can crash on
-- tables with CHECK constraints); the server validates these values instead.
-- =====================================================================

USE landayan_ers;

-- ---------------------------------------------------------------------
-- 1. Staff availability for live chat. "Away" until the person sets
--    "Available" (any LGU or response team account can be chat staff).
-- ---------------------------------------------------------------------
ALTER TABLE response_team
  ADD COLUMN IF NOT EXISTS chat_availability ENUM('Available','Away') NOT NULL DEFAULT 'Away';

ALTER TABLE lgu
  ADD COLUMN IF NOT EXISTS chat_availability ENUM('Available','Away') NOT NULL DEFAULT 'Away';

-- ---------------------------------------------------------------------
-- 2. chat_session: one conversation of a resident.
--    status: Bot          - talking to the rule-based chatbot
--            Waiting      - asked for a person, waiting for staff
--            Active       - a staff member joined
--            Closed       - finished
--            Message Left - chat was closed / no staff, resident left a message
--    staff_role + staff_id: the LGU or response team account that joined
--    (no foreign key, because it can point to either table).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_session (
  session_id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  resident_id            INT UNSIGNED NOT NULL,
  staff_role             ENUM('lgu','response_team') NULL,
  staff_id               INT UNSIGNED NULL,
  status                 ENUM('Bot','Waiting','Active','Closed','Message Left') NOT NULL DEFAULT 'Bot',
  estimated_wait_minutes INT NULL,
  date_started           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_ended             DATETIME NULL,
  PRIMARY KEY (session_id),
  KEY idx_chat_session_resident (resident_id),
  KEY idx_chat_session_status (status),
  KEY idx_chat_session_staff (staff_role, staff_id),
  CONSTRAINT fk_chat_session_resident FOREIGN KEY (resident_id)
    REFERENCES resident (resident_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. chat_message: every message in a session (deleted with the session).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_message (
  message_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id  INT UNSIGNED NOT NULL,
  sender_type ENUM('resident','bot','staff') NOT NULL,
  message     TEXT NOT NULL,
  date_sent   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY idx_chat_message_session (session_id, date_sent),
  CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id)
    REFERENCES chat_session (session_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. chat_schedule: when live chat is open (Asia/Manila time).
--    Weekly rows:  day_of_week 1 = Monday ... 7 = Sunday, specific_date NULL.
--    Special rows: specific_date set (e.g. a holiday), day_of_week NULL.
--                  A special row OVERRIDES the weekly row for that date
--                  (is_open = 0 -> closed all day; is_open = 1 -> these hours).
--    The UNIQUE keys allow only one row per weekday and one per date
--    (several NULLs are allowed, so weekly and special rows can share them).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_schedule (
  schedule_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lgu_id        INT UNSIGNED NOT NULL,
  day_of_week   TINYINT UNSIGNED NULL,
  specific_date DATE NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_open       BOOLEAN NOT NULL DEFAULT 1,
  PRIMARY KEY (schedule_id),
  UNIQUE KEY uq_chat_schedule_day (day_of_week),
  UNIQUE KEY uq_chat_schedule_date (specific_date),
  CONSTRAINT fk_chat_schedule_lgu FOREIGN KEY (lgu_id)
    REFERENCES lgu (lgu_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Default schedule: Monday-Friday 08:00-17:00 open; Saturday and
--    Sunday closed (kept with the same hours so the admin only has to
--    switch them on). INSERT IGNORE skips days that already have a row,
--    so an edited schedule is never overwritten. Uses the first LGU account.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO chat_schedule (lgu_id, day_of_week, specific_date, start_time, end_time, is_open)
SELECT first_lgu.lgu_id, days.day_of_week, NULL, '08:00:00', '17:00:00', days.is_open
FROM (SELECT MIN(lgu_id) AS lgu_id FROM lgu) AS first_lgu
JOIN (
  SELECT 1 AS day_of_week, 1 AS is_open UNION ALL
  SELECT 2, 1 UNION ALL
  SELECT 3, 1 UNION ALL
  SELECT 4, 1 UNION ALL
  SELECT 5, 1 UNION ALL
  SELECT 6, 0 UNION ALL
  SELECT 7, 0
) AS days
WHERE first_lgu.lgu_id IS NOT NULL;
