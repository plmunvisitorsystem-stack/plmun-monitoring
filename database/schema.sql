-- =====================================================================
-- Smart Environmental Reporting and Community Response System
-- Barangay Landayan, San Pedro City, Laguna
--
-- schema.sql : creates the database and its twelve tables.
-- Import in phpMyAdmin (Import tab) or run:  mysql -u root < schema.sql
-- WARNING: this DROPS the existing tables, so all data is erased.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS landayan_ers
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE landayan_ers;

-- Drop child tables first (they reference other tables), then parents.
-- Foreign key checks are off only while dropping, because notification and
-- chat_session reference each other's tables (re-importing would fail otherwise).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS staff_notification;
DROP TABLE IF EXISTS featured_case;
DROP TABLE IF EXISTS chat_message;
DROP TABLE IF EXISTS chat_session;
DROP TABLE IF EXISTS chat_schedule;
DROP TABLE IF EXISTS report_photo;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS report;
DROP TABLE IF EXISTS lgu;
DROP TABLE IF EXISTS response_team;
DROP TABLE IF EXISTS resident;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- ACCOUNT TABLES
-- Note: each table has its own UNIQUE username. Uniqueness ACROSS the
-- three tables (e.g. no resident may use the username "team1") is
-- checked by the API before an account is created.
-- ---------------------------------------------------------------------

-- Residents of the barangay who submit reports.
CREATE TABLE resident (
  resident_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100) NOT NULL,
  address        VARCHAR(255) NOT NULL,
  contact_info   VARCHAR(100) NOT NULL,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,          -- bcrypt hash, never the plain password
  account_status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  consent_date   DATETIME NULL,                    -- agreed to the Data Privacy Notice (set at registration)
  token_version  INT NOT NULL DEFAULT 0,           -- raised on logout / password change: old tokens stop working
  PRIMARY KEY (resident_id),
  UNIQUE KEY uq_resident_username (username)
) ENGINE=InnoDB;

-- Response teams that act on reports in the field.
CREATE TABLE response_team (
  team_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  team_name      VARCHAR(100) NOT NULL,
  assigned_area  VARCHAR(255) NOT NULL,
  contact_info   VARCHAR(100) NOT NULL,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  chat_availability ENUM('Available','Away') NOT NULL DEFAULT 'Away', -- live chat staff status
  token_version  INT NOT NULL DEFAULT 0,           -- raised on logout / password change
  PRIMARY KEY (team_id),
  UNIQUE KEY uq_team_username (username)
) ENGINE=InnoDB;

-- LGU officers / system administrators.
CREATE TABLE lgu (
  lgu_id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_name   VARCHAR(100) NOT NULL,
  officer_in_charge VARCHAR(100) NOT NULL,
  contact_info      VARCHAR(100) NOT NULL,
  username          VARCHAR(50)  NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  chat_availability ENUM('Available','Away') NOT NULL DEFAULT 'Away', -- live chat staff status
  token_version     INT NOT NULL DEFAULT 0,        -- raised on logout / password change
  PRIMARY KEY (lgu_id),
  UNIQUE KEY uq_lgu_username (username)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REPORT: an environmental concern submitted by a resident.
-- Status only moves forward: Submitted -> Under Review -> In Progress -> Resolved.
--   Under Review is set when the LGU assigns the report to a response team;
--   the team then moves it to In Progress and Resolved.
-- area:     a purok from server/config/areas.js
-- priority: set by the rules in server/config/rules.js when the report is submitted
-- similar_to_report_id: an earlier report with the same issue type and area
--                       submitted within SIMILAR_DAYS (NULL if none)
-- Shown on screen as #YYYY-#### (year of date_submitted + report_id, e.g. #2026-0102).
-- ---------------------------------------------------------------------
CREATE TABLE report (
  report_id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  resident_id          INT UNSIGNED NOT NULL,
  team_id              INT UNSIGNED NULL,           -- NULL until the LGU assigns a team
  issue_type           ENUM('Waste Disposal','Pollution','Flooding','Other Hazard') NOT NULL,
  area                 VARCHAR(50) NOT NULL,
  priority             ENUM('High','Medium','Low') NOT NULL DEFAULT 'Low',
  similar_to_report_id INT UNSIGNED NULL,
  location             VARCHAR(255) NOT NULL,
  description          TEXT NOT NULL,
  date_submitted       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status               ENUM('Submitted','Under Review','In Progress','Resolved') NOT NULL DEFAULT 'Submitted',
  resolution_notes     TEXT NULL,
  PRIMARY KEY (report_id),
  -- Indexes speed up the most common filters (my reports, team reports, status, type, date).
  KEY idx_report_resident (resident_id),
  KEY idx_report_team (team_id),
  KEY idx_report_status (status),
  KEY idx_report_issue_type (issue_type),
  KEY idx_report_date (date_submitted),
  KEY idx_report_priority (priority),
  -- Used by the smart rules: same area + issue type within a number of days.
  KEY idx_report_area_rules (area, issue_type, date_submitted),
  CONSTRAINT fk_report_resident FOREIGN KEY (resident_id)
    REFERENCES resident (resident_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_report_team FOREIGN KEY (team_id)
    REFERENCES response_team (team_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_report_similar FOREIGN KEY (similar_to_report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- FEEDBACK: a resident's rating (1-5) of how a report was handled.
-- ---------------------------------------------------------------------
CREATE TABLE feedback (
  feedback_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  resident_id    INT UNSIGNED NOT NULL,
  report_id      INT UNSIGNED NOT NULL,
  comments       TEXT NULL,
  rating         TINYINT UNSIGNED NOT NULL,
  date_submitted DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  KEY idx_feedback_resident (resident_id),
  KEY idx_feedback_report (report_id),
  CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_feedback_resident FOREIGN KEY (resident_id)
    REFERENCES resident (resident_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_feedback_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- NOTIFICATION: a message about a report (e.g. a status update).
-- The resident who receives it is the owner of the linked report.
-- ---------------------------------------------------------------------
CREATE TABLE notification (
  notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id       INT UNSIGNED NULL,     -- the report it is about, OR
  chat_session_id INT UNSIGNED NULL,     -- the live chat it is about (reply to a left message)
  message         VARCHAR(500) NOT NULL,
  date_sent       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('Unread','Read') NOT NULL DEFAULT 'Unread',
  PRIMARY KEY (notification_id),
  KEY idx_notification_report (report_id),
  KEY idx_notification_status (status),
  KEY idx_notification_chat (chat_session_id),
  CONSTRAINT fk_notification_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REPORT_PHOTO: photos attached to a report (up to MAX_PHOTOS per report,
-- each up to MAX_PHOTO_MB - see server/config/rules.js).
-- file_path is relative to the server's upload folder.
-- Deleting a report deletes its photo records too.
-- ---------------------------------------------------------------------
CREATE TABLE report_photo (
  photo_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id     INT UNSIGNED NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  date_uploaded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id),
  KEY idx_photo_report (report_id),
  CONSTRAINT fk_photo_report FOREIGN KEY (report_id)
    REFERENCES report (report_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- HELP AND SUPPORT (chatbot + live chat). The default Chat Schedule
-- (Monday-Friday 8:00 AM - 5:00 PM) is added by seed.sql.
-- =====================================================================
-- ---------------------------------------------------------------------
-- chat_session: one conversation of a resident.
--    status: Bot          - talking to the rule-based chatbot
--            Waiting      - asked for a person, waiting for staff
--            Active       - a staff member joined
--            Closed       - finished
--            Message Left - chat was closed / no staff, resident left a message
--    staff_role + staff_id: the LGU or response team account that joined
--    (no foreign key, because it can point to either table).
-- ---------------------------------------------------------------------
CREATE TABLE chat_session (
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
-- chat_message: every message in a session (deleted with the session).
-- ---------------------------------------------------------------------
CREATE TABLE chat_message (
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
-- chat_schedule: when live chat is open (Asia/Manila time).
--    Weekly rows:  day_of_week 1 = Monday ... 7 = Sunday, specific_date NULL.
--    Special rows: specific_date set (e.g. a holiday), day_of_week NULL.
--                  A special row OVERRIDES the weekly row for that date
--                  (is_open = 0 -> closed all day; is_open = 1 -> these hours).
--    The UNIQUE keys allow only one row per weekday and one per date
--    (several NULLs are allowed, so weekly and special rows can share them).
-- ---------------------------------------------------------------------
CREATE TABLE chat_schedule (
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
-- featured_case: resolved reports shown in the public landing page
--    slideshow, with an LGU caption and an "after" photo
--    (server/uploads/featured/). A report can be featured only once.
--    is_visible is also set to 0 automatically if the report is no
--    longer Resolved.
-- ---------------------------------------------------------------------
CREATE TABLE featured_case (
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

-- Notifications about a live chat (reply to a left message) point to the session.
ALTER TABLE notification
  ADD CONSTRAINT fk_notification_chat FOREIGN KEY (chat_session_id)
    REFERENCES chat_session (session_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- staff_notification: the bell for LGU and response team accounts.
--    One row per recipient account. The client builds the text (EN/TL)
--    from type + report + detail (see migration_v5.sql for the types).
-- ---------------------------------------------------------------------
CREATE TABLE staff_notification (
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
