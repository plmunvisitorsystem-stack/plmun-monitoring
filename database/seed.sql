-- =====================================================================
-- seed.sql : sample data for testing and the capstone demo.
-- Import AFTER schema.sql. Safe to re-import: it empties the tables first.
--
-- All six accounts use the password:  Password123!
-- (stored as bcrypt hashes; generate new ones with: npm run hash -- "Password")
--
--   LGU            : admin
--   Response teams : team1 (Purok 1-3), team2 (Purok 4-7)
--   Residents      : juan, maria, pedro
--
-- 48 reports: Submitted 6, Under Review 12, In Progress 12, Resolved 18
-- (12 per issue type). Every report past Submitted is assigned to the team
-- of its area (v2 rule). Areas come from server/config/areas.js; priorities
-- follow services/smartRules.js (base priority per issue type: Flooding
-- High, Pollution/Other Hazard Medium, Waste Disposal Low; raised one level
-- when 3 matching reports arrive within 7 days). Similar-report links follow
-- server/config/rules.js.
-- =====================================================================

USE landayan_ers;

-- Empty all tables (child tables first because of the foreign keys).
-- We use DELETE instead of TRUNCATE: TRUNCATE on a table with a CHECK
-- constraint (feedback.rating) crashes the MariaDB version bundled with XAMPP.
DELETE FROM featured_case;
DELETE FROM chat_message;
DELETE FROM chat_session;
DELETE FROM chat_schedule;
DELETE FROM report_photo;
DELETE FROM notification;
DELETE FROM feedback;
DELETE FROM report;
DELETE FROM lgu;
DELETE FROM response_team;
DELETE FROM resident;

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
INSERT INTO lgu (lgu_id, department_name, officer_in_charge, contact_info, username, password_hash) VALUES
  (1, 'Barangay Landayan Environment Office', 'Ana Villanueva', '0917 000 1001', 'admin', '$2b$10$mJzqrzyeZBp0SDtYh.WXS.jzkn/bNRLouzsDoCt7RF8iop2uG/3ye');

INSERT INTO response_team (team_id, team_name, assigned_area, contact_info, username, password_hash) VALUES
  (1, 'Response Team 1', 'Purok 1, Purok 2, Purok 3', '0917 000 2001', 'team1', '$2b$10$w2b60WVXDE33Z2DHm1jqqOgOd6iPhbzpsOFE0XE4sbyEVbPIbeWkG'),
  (2, 'Response Team 2', 'Purok 4, Purok 5, Purok 6, Purok 7', '0917 000 2002', 'team2', '$2b$10$sMYvEyIR7pkc2usImiESp.bITHJ5rPf4O9X97LCW71M39fE.EQLqy');

INSERT INTO resident (resident_id, name, address, contact_info, username, password_hash, account_status) VALUES
  (1, 'Juan Dela Cruz', 'Purok 2, Rosal Street, Barangay Landayan', '0917 000 3001', 'juan', '$2b$10$MWmq2OrJBG5QV7TdHERTyelCViyhb7G70gcmPp2Q/Ce9kQmuP4pXW', 'Active'),
  (2, 'Maria Santos', 'Purok 4, Camia Street, Barangay Landayan', '0917 000 3002', 'maria', '$2b$10$21shzcLclj5sj5BFwNr/6uD6dOBCcsIPeSnm8pBsHlhljyDsT1WiK', 'Active'),
  (3, 'Pedro Reyes', 'Landayan Road, Barangay Landayan', '0917 000 3003', 'pedro', '$2b$10$qGE9afwdTylnffhJ0vBL1uv7LXD.5oVT7W/MFF1FkymUbksI2Rumq', 'Active');

-- ---------------------------------------------------------------------
-- Chat Schedule (Asia/Manila): Monday-Friday 8:00 AM - 5:00 PM open;
-- Saturday and Sunday closed (same hours kept, so the admin can switch them on).
-- day_of_week: 1 = Monday ... 7 = Sunday.
-- ---------------------------------------------------------------------
INSERT INTO chat_schedule (schedule_id, lgu_id, day_of_week, specific_date, start_time, end_time, is_open) VALUES
  (1, 1, 1, NULL, '08:00:00', '17:00:00', 1),
  (2, 1, 2, NULL, '08:00:00', '17:00:00', 1),
  (3, 1, 3, NULL, '08:00:00', '17:00:00', 1),
  (4, 1, 4, NULL, '08:00:00', '17:00:00', 1),
  (5, 1, 5, NULL, '08:00:00', '17:00:00', 1),
  (6, 1, 6, NULL, '08:00:00', '17:00:00', 0),
  (7, 1, 7, NULL, '08:00:00', '17:00:00', 0);

-- ---------------------------------------------------------------------
-- Reports (report_id follows date order; shown as #YYYY-####)
-- ---------------------------------------------------------------------
INSERT INTO report (report_id, resident_id, team_id, issue_type, area, priority, similar_to_report_id, location, description, date_submitted, status, resolution_notes) VALUES
  (1, 1, 1, 'Flooding', 'Purok 3', 'High', NULL, 'Purok 3, Sampaguita Street', 'Drainage canal is clogged and the street floods ankle-deep after every rain.', '2026-01-12 07:45:00', 'Resolved', 'Canal declogged and silt removed. Street drains normally now.'),
  (2, 2, 2, 'Other Hazard', 'Purok 6', 'Medium', NULL, 'Landayan Road, near the public market', 'A loose electric wire is hanging low over the sidewalk.', '2026-01-27 16:20:00', 'Resolved', 'Coordinated with the electric company; wire was secured and raised.'),
  (3, 3, 1, 'Waste Disposal', 'Purok 1', 'Low', NULL, 'Purok 1, near the chapel', 'Garbage has not been collected for over a week and is attracting stray dogs.', '2026-02-09 08:10:00', 'Resolved', 'Collection truck rerouted; area cleared and schedule posted.'),
  (4, 1, 2, 'Pollution', 'Purok 4', 'Medium', NULL, 'Purok 4, near the day care center', 'Neighbors are burning plastic trash every evening. The smoke enters the day care.', '2026-02-21 19:05:00', 'Resolved', 'Residents were reminded of the no-burning ordinance; follow-up checks show no more burning.'),
  (5, 2, 2, 'Flooding', 'Purok 5', 'High', NULL, 'Purok 5, along the creek', 'Creek water is rising and plastic waste is blocking the flow under the footbridge.', '2026-03-04 06:30:00', 'Resolved', 'Waste under the footbridge was removed; creek flow restored.'),
  (6, 3, 1, 'Other Hazard', 'Purok 2', 'Medium', NULL, 'Purok 2, beside the basketball court', 'A large tree branch is cracked and may fall on the court.', '2026-03-16 14:00:00', 'Resolved', 'Branch was cut down safely by the team.'),
  (7, 1, 2, 'Waste Disposal', 'Purok 7', 'Low', NULL, 'Landayan Road, near the tricycle terminal', 'Illegal dumping of construction debris on the road shoulder.', '2026-03-29 09:25:00', 'Resolved', 'Debris hauled away; warning sign installed.'),
  (8, 2, 1, 'Pollution', 'Purok 3', 'Medium', NULL, 'Purok 3, near the elementary school', 'Strong foul smell coming from an open drainage near the school gate.', '2026-04-08 11:40:00', 'Resolved', 'Drainage cleaned and disinfected; cover replaced.'),
  (9, 3, 1, 'Flooding', 'Purok 1', 'High', NULL, 'Purok 1, Ilang-Ilang Street', 'Water stays on the street for days after rain because a manhole is blocked.', '2026-04-22 17:15:00', 'Resolved', 'Manhole cleared and inspected; no more standing water.'),
  (10, 1, 2, 'Other Hazard', 'Purok 4', 'Medium', NULL, 'Purok 4, near the barangay hall', 'An open manhole without a cover is dangerous for children.', '2026-05-05 10:50:00', 'Resolved', 'New manhole cover installed.'),
  (11, 2, 2, 'Waste Disposal', 'Purok 5', 'Low', NULL, 'Purok 5, near the covered court', 'Overflowing trash bins after the weekend event.', '2026-05-18 07:05:00', 'Resolved', 'Bins emptied and extra bins provided for events.'),
  (12, 3, 2, 'Pollution', 'Purok 6', 'Medium', NULL, 'Landayan Road, near the gas station', 'Oil and wastewater are being washed into the street canal.', '2026-05-30 13:35:00', 'Resolved', 'Business owner instructed to install a grease trap; canal cleaned.'),
  (13, 1, 1, 'Flooding', 'Purok 2', 'High', NULL, 'Purok 2, Rosal Street', 'Heavy rain last night flooded several houses. Canal outlet is blocked.', '2026-06-11 05:55:00', 'Resolved', 'Canal outlet cleared with the help of residents.'),
  (14, 2, 1, 'Other Hazard', 'Purok 3', 'Medium', NULL, 'Purok 3, near the river bank', 'Part of the river bank is eroding near the houses.', '2026-06-24 15:10:00', 'Resolved', 'Sandbags placed; area reported to the City Engineering Office.'),
  (15, 3, 1, 'Waste Disposal', 'Purok 2', 'Low', NULL, 'Purok 2, near the sari-sari store', 'Mixed garbage is piled beside the store every day.', '2026-06-28 09:00:00', 'In Progress', NULL),
  (16, 1, 2, 'Waste Disposal', 'Purok 4', 'Low', NULL, 'Purok 4, Camia Street', 'Garbage bags left on the corner are torn open by animals.', '2026-07-07 08:45:00', 'Resolved', 'Corner cleaned; residents reminded of the collection schedule.'),
  (17, 2, 2, 'Pollution', 'Purok 7', 'Medium', NULL, 'Landayan Road, near the tricycle terminal', 'Thick black smoke from idling vehicles near the terminal.', '2026-07-15 18:40:00', 'In Progress', NULL),
  (18, 3, 1, 'Pollution', 'Purok 1', 'Medium', NULL, 'Purok 1, near the piggery', 'Very strong smell from the backyard piggery, especially at night.', '2026-07-19 20:30:00', 'Resolved', 'Owner advised to clean pens daily and fix the waste pit.'),
  (19, 1, 2, 'Flooding', 'Purok 6', 'High', NULL, 'Landayan Road, near the public market', 'Road is flooded knee-deep; tricycles cannot pass.', '2026-08-02 06:15:00', 'Resolved', 'Drainage pumped and cleared; road passable again.'),
  (20, 2, 2, 'Flooding', 'Purok 4', 'High', NULL, 'Purok 4, Camia Street', 'Canal is overflowing during heavy rain and water enters houses.', '2026-08-08 05:30:00', 'In Progress', NULL),
  (21, 3, 2, 'Other Hazard', 'Purok 5', 'Medium', NULL, 'Purok 5, along the creek', 'A fallen tree is blocking the footpath beside the creek.', '2026-08-14 12:25:00', 'Resolved', 'Tree cut and removed from the footpath.'),
  (22, 1, 1, 'Other Hazard', 'Purok 1', 'Medium', NULL, 'Purok 1, near the chapel', 'A leaning electric post looks like it may fall.', '2026-08-21 13:15:00', 'In Progress', NULL),
  (23, 2, 2, 'Waste Disposal', 'Purok 6', 'Low', NULL, 'Landayan Road, near the public market', 'Market vendors leave fish and vegetable waste on the road at night.', '2026-08-27 09:40:00', 'Under Review', NULL),
  (24, 3, 2, 'Waste Disposal', 'Purok 5', 'Low', NULL, 'Purok 5, near the covered court', 'Uncollected garbage near the court is starting to smell.', '2026-09-03 07:50:00', 'In Progress', NULL),
  (25, 1, 2, 'Pollution', 'Purok 5', 'Medium', NULL, 'Purok 5, near the covered court', 'Someone is burning leaves and rubber in an empty lot.', '2026-09-08 19:20:00', 'Under Review', NULL),
  (26, 2, 1, 'Pollution', 'Purok 3', 'Medium', NULL, 'Purok 3, near the elementary school', 'Loud generator and diesel fumes at night beside the school.', '2026-09-12 21:10:00', 'In Progress', NULL),
  (27, 3, 1, 'Flooding', 'Purok 2', 'High', NULL, 'Purok 2, Rosal Street', 'Water collects in front of houses whenever it rains for more than an hour.', '2026-09-16 07:10:00', 'Under Review', NULL),
  (28, 1, 1, 'Flooding', 'Purok 1', 'High', NULL, 'Purok 1, Ilang-Ilang Street', 'Flood water does not drain for two days after the typhoon.', '2026-09-19 06:05:00', 'In Progress', NULL),
  (29, 2, 2, 'Other Hazard', 'Purok 4', 'Medium', NULL, 'Purok 4, near the barangay hall', 'A damaged steel signboard is about to fall in strong wind.', '2026-09-22 15:55:00', 'Under Review', NULL),
  (30, 3, 2, 'Other Hazard', 'Purok 6', 'Medium', NULL, 'Landayan Road, near the gas station', 'A deep pothole filled with water is dangerous for motorcycles.', '2026-09-26 16:45:00', 'In Progress', NULL),
  (31, 1, 1, 'Waste Disposal', 'Purok 3', 'Low', NULL, 'Purok 3, Sampaguita Street', 'Bulky waste (old sofa and mattress) left on the sidewalk.', '2026-09-29 08:05:00', 'Under Review', NULL),
  (32, 2, 2, 'Waste Disposal', 'Purok 4', 'Low', NULL, 'Purok 4, near the day care center', 'Broken glass and sharp waste dumped beside the day care fence.', '2026-10-02 08:20:00', 'In Progress', NULL),
  (33, 3, 1, 'Pollution', 'Purok 1', 'Medium', NULL, 'Purok 1, near the piggery', 'Wastewater from the piggery is flowing into the street canal.', '2026-10-03 11:25:00', 'Under Review', NULL),
  (34, 1, 1, 'Pollution', 'Purok 2', 'Medium', NULL, 'Purok 2, beside the basketball court', 'Canal water is dark and smells like chemicals.', '2026-10-06 10:35:00', 'In Progress', NULL),
  (35, 2, 2, 'Flooding', 'Purok 7', 'High', NULL, 'Landayan Road, near the tricycle terminal', 'Rainwater pools at the terminal and passengers have to wade through.', '2026-10-07 06:40:00', 'Under Review', NULL),
  (36, 3, 2, 'Other Hazard', 'Purok 5', 'Medium', NULL, 'Purok 5, along the creek', 'Broken railing on the footbridge over the creek.', '2026-10-10 17:30:00', 'Under Review', NULL),
  (37, 1, 1, 'Other Hazard', 'Purok 3', 'Medium', NULL, 'Purok 3, near the river bank', 'Stray dogs gathering near the river bank are aggressive to children.', '2026-10-11 14:30:00', 'In Progress', NULL),
  (38, 2, 2, 'Waste Disposal', 'Purok 4', 'Low', NULL, 'Purok 4, Camia Street', 'Residents are throwing garbage into the vacant lot.', '2026-10-12 07:35:00', 'Under Review', NULL),
  (39, 3, 1, 'Pollution', 'Purok 2', 'Medium', NULL, 'Purok 2, near the sari-sari store', 'Videoke and loudspeakers until 2 AM every weekend.', '2026-10-13 20:15:00', 'Under Review', NULL),
  (40, 1, 2, 'Flooding', 'Purok 4', 'High', NULL, 'Purok 4, near the day care center', 'Day care entrance floods and children walk through dirty water.', '2026-10-14 05:50:00', 'Under Review', NULL),
  (41, 2, 1, 'Other Hazard', 'Purok 1', 'Medium', NULL, 'Purok 1, Ilang-Ilang Street', 'Exposed and sparking wires on an electric post after the storm.', '2026-10-14 13:05:00', 'Under Review', NULL),
  (42, 3, 2, 'Flooding', 'Purok 4', 'High', 40, 'Purok 4, Camia Street', 'Flood water from the blocked canal is entering houses on Camia Street.', '2026-10-15 05:45:00', 'In Progress', NULL),
  (43, 1, NULL, 'Waste Disposal', 'Purok 5', 'Low', NULL, 'Purok 5, near the covered court', 'Garbage collection missed our street this week.', '2026-10-16 08:30:00', 'Submitted', NULL),
  (44, 2, NULL, 'Pollution', 'Purok 6', 'Medium', NULL, 'Landayan Road, near the gas station', 'Strong smell of gasoline near the canal beside the station.', '2026-10-18 18:50:00', 'Submitted', NULL),
  (45, 3, NULL, 'Flooding', 'Purok 4', 'High', NULL, 'Purok 4, Camia Street', 'Canal is blocked again and water is rising after this morning''s rain.', '2026-10-20 06:20:00', 'Submitted', NULL),
  (46, 1, NULL, 'Other Hazard', 'Purok 2', 'Medium', NULL, 'Purok 2, beside the basketball court', 'Wasp nest on the tree beside the court; a child was stung.', '2026-10-21 15:40:00', 'Submitted', NULL),
  (47, 2, NULL, 'Waste Disposal', 'Purok 1', 'Low', NULL, 'Purok 1, near the chapel', 'Plastic waste scattered around the chapel after the fiesta.', '2026-10-22 09:15:00', 'Submitted', NULL),
  (48, 3, NULL, 'Pollution', 'Purok 3', 'Medium', NULL, 'Purok 3, Sampaguita Street', 'Neighbor is burning garbage in the backyard; the smoke enters our house.', '2026-10-23 19:30:00', 'Submitted', NULL);

-- ---------------------------------------------------------------------
-- Notifications for Resolved reports (the newest 3 are still Unread)
-- ---------------------------------------------------------------------
INSERT INTO notification (notification_id, report_id, message, date_sent, status) VALUES
  (1, 1, 'Your report has been resolved.', '2026-01-15 15:30:00', 'Read'),
  (2, 2, 'Your report has been resolved.', '2026-01-31 15:30:00', 'Read'),
  (3, 3, 'Your report has been resolved.', '2026-02-14 15:30:00', 'Read'),
  (4, 4, 'Your report has been resolved.', '2026-02-27 15:30:00', 'Read'),
  (5, 6, 'Your report has been resolved.', '2026-03-19 15:30:00', 'Read'),
  (6, 7, 'Your report has been resolved.', '2026-04-02 15:30:00', 'Read'),
  (7, 9, 'Your report has been resolved.', '2026-04-27 15:30:00', 'Read'),
  (8, 10, 'Your report has been resolved.', '2026-05-11 15:30:00', 'Read'),
  (9, 12, 'Your report has been resolved.', '2026-06-02 15:30:00', 'Read'),
  (10, 14, 'Your report has been resolved.', '2026-06-28 15:30:00', 'Unread'),
  (11, 18, 'Your report has been resolved.', '2026-07-24 15:30:00', 'Unread'),
  (12, 19, 'Your report has been resolved.', '2026-08-08 15:30:00', 'Unread');

-- ---------------------------------------------------------------------
-- Feedback from residents on some Resolved reports
-- ---------------------------------------------------------------------
INSERT INTO feedback (feedback_id, resident_id, report_id, comments, rating, date_submitted) VALUES
  (1, 1, 1, 'Very fast response. The canal is clean now. Thank you!', 5, '2026-01-16 09:00:00'),
  (2, 2, 2, 'The wire was fixed, but it took a few days.', 4, '2026-02-01 09:00:00'),
  (3, 3, 3, 'Area is clean and the schedule is posted. Salamat po!', 5, '2026-02-15 09:00:00'),
  (4, 1, 4, 'The burning stopped for a while but started again once.', 3, '2026-02-28 09:00:00'),
  (5, 3, 6, 'The team was careful and polite.', 5, '2026-03-20 09:00:00'),
  (6, 1, 7, 'Good work, I hope the warning sign stays.', 4, '2026-04-03 09:00:00'),
  (7, 3, 9, 'No more flooding on our street.', 5, '2026-04-28 09:00:00'),
  (8, 1, 10, 'Solved, but I had to follow up several times.', 2, '2026-05-12 09:00:00'),
  (9, 3, 12, 'The bins helped a lot during the event.', 4, '2026-06-03 09:00:00');

-- ---------------------------------------------------------------------
-- Overdue demo: report #37 (In Progress, Response Team 1) is dated
-- 8 days before the moment this file is imported, so it is always overdue
-- (OVERDUE_DAYS = 7 in server/config/rules.js). It stops being overdue
-- once the team marks it Resolved.
-- ---------------------------------------------------------------------
UPDATE report SET date_submitted = NOW() - INTERVAL 8 DAY WHERE report_id = 37;
