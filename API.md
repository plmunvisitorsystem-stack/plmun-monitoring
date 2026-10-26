# API Reference

Base URL: `http://localhost:5000/api` (the client calls `/api/...` through the Vite proxy).

## How requests work

- **Login token.** `POST /auth/login` returns a JWT. Send it on every protected request:
  `Authorization: Bearer <token>`. Tokens expire after `JWT_EXPIRES_IN` (default 8 hours).
- **Role check.** Every protected route checks the token **and** the role. A wrong role returns **403**, a missing or invalid token returns **401**. A resident whose account was deactivated gets **403 `ACCOUNT_INACTIVE`** even with an old token.
- **JSON in, JSON out.** Send `Content-Type: application/json`. Bodies larger than 100 KB are rejected.
- **Errors** always look like this (the client translates `code` into English or Tagalog):

  ```json
  { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.", "fields": { "location": "LOCATION_TOO_SHORT" } }
  ```

- **Database values stay in English** (statuses, issue types, notification messages); only the display is translated.
- **Report IDs** are numbers in the API (`13`) and are shown as `#YYYY-####` (`#2026-0013`).

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Invalid input (`VALIDATION_FAILED`, `INVALID_JSON`, `INVALID_FILTER`, `NOTES_REQUIRED`, …) |
| 401 | Not logged in, bad or expired token (`UNAUTHORIZED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS`) |
| 403 | Logged in but not allowed (`FORBIDDEN`, `ACCOUNT_INACTIVE`, `NOT_ASSIGNED_TO_TEAM`) |
| 404 | Not found (`NOT_FOUND`) |
| 409 | Conflict (`USERNAME_TAKEN`, `FEEDBACK_EXISTS`, `REPORT_NOT_RESOLVED`, `INVALID_STATUS_CHANGE`, `REPORT_ALREADY_RESOLVED`) |
| 413 | Request body too large |
| 500 | Unexpected server error (`SERVER_ERROR`) — the server keeps running |

---

## All endpoints

**Role** column: *Public* = no login; *Any* = resident, response team, or LGU; otherwise the only role(s) allowed.

| # | Method | Route | Role | Purpose |
|---|---|---|---|---|
| 1 | GET | `/health` | Public | Check that the API and database are running |
| 2 | GET | `/areas` | Public | The list of areas (puroks) from `server/config/areas.js` |
| 3 | GET | `/config` | Public | Photo limits from `server/config/rules.js`: `{ maxPhotos, maxPhotoMb }` |
| 4 | GET | `/public/resolved-cases` | Public | Landing page slideshow: visible featured cases (max 10), no personal data |
| 5 | GET | `/public/resolved-cases/:id/photo` | Public | The "after" photo of a visible featured case |
| 6 | POST | `/auth/register` | Public | Create a **resident** account |
| 7 | POST | `/auth/login` | Public | Log in (any role); returns a token and user info |
| 8 | GET | `/auth/me` | Any | The logged-in account |
| 9 | GET | `/resident/reports` | Resident | My reports, newest first |
| 10 | GET | `/resident/notifications` | Resident | My notifications, newest first, with unread count |
| 11 | POST | `/reports` | Resident | Submit a new report |
| 12 | GET | `/reports/similar` | Resident | `?issue_type=&area=`: is there a similar unresolved report? (date only) |
| 13 | GET | `/reports/:id` | Resident | One of my reports (another resident's → 403) |
| 14 | POST | `/reports/:id/feedback` | Resident | Rate my Resolved report once (1–5 stars) |
| 15 | PATCH | `/notifications/:id/read` | Resident | Mark one of my notifications as read |
| 16 | PATCH | `/notifications/read-all` | Resident | Mark all my notifications as read |
| 17 | GET | `/profile` | Any | My profile (role-specific fields) |
| 18 | PUT | `/profile` | Any | Save my profile fields |
| 19 | PUT | `/profile/password` | Any | Change my password (needs the current one) |
| 20 | GET | `/team/reports` | Response Team | Reports list: **only reports assigned to my team**; filters, search, 10 per page |
| 21 | GET | `/team/reports/:id` | Response Team | One of my team's reports with the resident's name and the allowed next status |
| 22 | PATCH | `/team/reports/:id` | Response Team | Under Review → In Progress → Resolved, save notes, notify the resident |
| 23 | GET | `/dashboard/summary` | Response Team, LGU | Totals per status / issue type / month and recent reports |
| 24 | GET | `/alerts/overdue` | Response Team, LGU | Overdue reports (team: only its own) |
| 25 | POST | `/chatbot/start` | Resident | Start or continue a chatbot conversation |
| 26 | POST | `/chatbot/message` | Resident | Send a menu choice or typed question; get the bot's answer |
| 27 | GET | `/livechat/current` | Resident | My open live chat (with messages) and the messages I left |
| 28 | POST | `/livechat/request` | Resident | Join the live chat queue (only when open and staff are Available) |
| 29 | POST | `/livechat/leave` | Resident | Leave a message for staff |
| 30 | POST | `/livechat/sessions/:id/rating` | Resident | Rate an ended chat 1–5 (optional, once) |
| 31 | GET | `/livechat/availability` | Response Team, LGU | My chat availability |
| 32 | PATCH | `/livechat/availability` | Response Team, LGU | Set Available / Away |
| 33 | GET | `/livechat/queue` | Response Team, LGU (Available) | Waiting residents (oldest first) + my active chats |
| 34 | POST | `/livechat/sessions/:id/accept` | Response Team, LGU (Available) | Accept a waiting resident with the estimated reply time |
| 35 | GET | `/livechat/messages-left` | Response Team, LGU | Messages left that are not answered yet |
| 36 | POST | `/livechat/sessions/:id/reply` | Response Team, LGU | Answer a left message (notifies the resident) |
| 37 | GET | `/livechat/sessions/:id` | The chat's resident or staff member | One chat (staff also get the resident's latest reports) |
| 38 | POST | `/livechat/sessions/:id/messages` | The chat's resident or staff member | Send a message |
| 39 | POST | `/livechat/sessions/:id/end` | The chat's resident or staff member | End the chat |
| 40 | GET | `/chat/status` | Any | Is live chat open now, today's hours, next opening, available staff |
| 41 | GET | `/hotspots` | Response Team, LGU | Areas with many recent reports (team: only its assigned area) |
| 42 | GET | `/admin/users` | LGU | Residents and response teams, with filters and search |
| 43 | POST | `/admin/teams` | LGU | Add a response team account |
| 44 | PUT | `/admin/teams/:id` | LGU | Edit a response team's details |
| 45 | PATCH | `/admin/residents/:id/status` | LGU | Activate / deactivate a resident |
| 46 | GET | `/admin/performance` | LGU | Totals, per-team numbers, resolution rate |
| 47 | GET | `/admin/reports` | LGU | All reports for assigning: filters, High priority + oldest first, 10 per page |
| 48 | GET | `/admin/reports/export` | LGU | Filtered report summary + rows (JSON or CSV file) |
| 49 | GET | `/admin/reports/:id` | LGU | One report + every team, with the team that covers its area marked as suggested |
| 50 | PATCH | `/admin/reports/:id/assign` | LGU | `{ team_id }`: assign or reassign (Submitted → Under Review, resident notified) |
| 51 | GET | `/admin/featured-cases` | LGU | Featured cases (landing page slideshow), in order |
| 52 | POST | `/admin/featured-cases` | LGU | Feature a Resolved report: caption + one "after" photo (multipart) |
| 53 | PUT | `/admin/featured-cases/:id` | LGU | Edit the caption (and optionally replace the photo) |
| 54 | PATCH | `/admin/featured-cases/:id/visibility` | LGU | `{ isVisible }`: show or hide on the landing page |
| 55 | PATCH | `/admin/featured-cases/:id/move` | LGU | `{ direction }` ("up" or "down"): change the slideshow order |
| 56 | DELETE | `/admin/featured-cases/:id` | LGU | Remove from the slideshow (and delete its photo) |
| 57 | GET | `/admin/featured-cases/:id/photo` | LGU | The "after" photo (also of hidden cases) |
| 58 | GET | `/photos/:id` | Owner resident, assigned team, LGU | One report photo (others → 403) |
| 59 | GET | `/admin/chat-schedule` | LGU | Weekly hours, upcoming special dates, open/closed now |
| 60 | PUT | `/admin/chat-schedule/weekly` | LGU | Save the hours of all 7 weekdays |
| 61 | POST | `/admin/chat-schedule/special` | LGU | Add (or replace) a holiday / special date |
| 62 | DELETE | `/admin/chat-schedule/special/:id` | LGU | Remove a special date |
| 63 | GET | `/staff/notifications` | Response Team, LGU | My newest 30 notifications (the bell) + unread count |
| 64 | PATCH | `/staff/notifications/:id/read` | Response Team, LGU | Mark one of my notifications as read |
| 65 | PATCH | `/staff/notifications/read-all` | Response Team, LGU | Mark all my notifications as read |
| 66 | GET | `/public/contact` | Public | Barangay contact details and today's live chat hours |
| 67 | GET | `/public/hotlines` | Public | Emergency hotlines (911 first, unconfirmed ones flagged) |
| 68 | POST | `/auth/logout` | Any | Log out: every token of this account stops working |

---

## Details

### Accounts

**POST `/auth/register`** — residents only
Body: `name`, `address`, `contactInfo` (PH mobile: `09XXXXXXXXX` or `+639XXXXXXXXX`, spaces/dashes allowed), `username` (4–30 letters, numbers, `.` `_`), `password` (8–72 characters), `confirmPassword`, `privacyConsent` (must be exactly `true`: the resident agreed to the Data Privacy Notice at `/privacy`; otherwise `400 VALIDATION_FAILED` with `fields.privacyConsent = "CONSENT_REQUIRED"`).
The username must be unused in **all** account tables (residents, teams, LGU), ignoring capital letters → otherwise `409 USERNAME_TAKEN`. Saves `resident.consent_date = NOW()`. Returns `201 { code: "REGISTERED" }`.

**POST `/auth/login`**
Body: `username`, `password`. Returns `{ token, user: { id, role, name, username } }` where `role` is `resident`, `response_team`, or `lgu`.
Wrong username or password → `401 INVALID_CREDENTIALS` (same answer for both, so usernames cannot be guessed). Inactive resident (after a correct password) → `403 ACCOUNT_INACTIVE`.

**Tokens** carry `{ id, role, tv }`, where `tv` is the account's `token_version` when the token was made. Every protected request and every Socket.IO connection compares it with the current `token_version`; an older token → `401 SESSION_EXPIRED`.

**POST `/auth/logout`** (any logged-in account) → `{ code: "LOGGED_OUT" }`. Raises the account's `token_version`, so this token and any other copy of it (e.g. another phone) stop working at once, and closes the account's open Socket.IO connections. The client also deletes its saved token.

### Resident

**GET `/resident/reports`** → `{ reports: [{ id, issueType, location, description, dateSubmitted, status }] }`

**GET `/areas`** → `{ areas: ["Purok 1", …, "Purok 7"] }` (edit `server/config/areas.js` to change the list).

**POST `/reports`** — send as JSON, or as **multipart/form-data** to attach photos.
Photos: up to `MAX_PHOTOS` (5) files in the field **`photos`**, JPG or PNG, each up to `MAX_PHOTO_MB` (5 MB). The server checks the real file type from the file's first bytes (a PDF renamed to `.jpg` is rejected), saves them with random names in `server/uploads/reports/`, and saves nothing if any file is rejected: `400 TOO_MANY_PHOTOS`, `400 PHOTO_TOO_LARGE`, `400 INVALID_PHOTO_TYPE` (the answer includes `limits: { maxPhotos, maxPhotoMb }`).
Fields: `issueType` (`Waste Disposal` · `Pollution` · `Flooding` · `Other Hazard`), `area` (one of `/areas`; missing → `AREA_REQUIRED`, unknown → `INVALID_AREA`), `location` (3–150 characters), `description` (10–1000 characters).
Saves status `Submitted` (no team yet) with the current date and creates the notification "Your report has been submitted." in one transaction.
The **smart rules** (`server/services/smartRules.js`, numbers in `server/config/rules.js`) set `priority` and `similarToReportId`:
- `priority` starts at the issue type's base (Flooding `High`; Pollution, Other Hazard `Medium`; Waste Disposal `Low`). If `PRIORITY_RAISE_COUNT` (3) or more reports with the same issue type and area were submitted in the last `PRIORITY_RAISE_DAYS` (7) days, including this one, it is raised one level (max `High`), and the other **unresolved** matching reports are raised to the same level.
- `similarToReportId` = the newest **unresolved** report with the same issue type and area from the last `SIMILAR_DAYS` (3) days, or `null`.

**GET `/reports/similar?issue_type=&area=`** (residents) → `{ similar: { dateSubmitted } }` or `{ similar: null }`, using the same similar-report rule. Only the date is returned, never another resident's report details. Unknown issue type or area → `400 INVALID_FILTER`.
The same report sent again within 60 seconds (double-click) returns the existing report with `200` instead of creating a second one.

**GET `/photos/:id`** — the image file (JPG/PNG). Allowed: the resident who owns the report, the response team assigned to it, and the LGU; others → `403`, no login → `401`. Sent with `Cache-Control: no-store` so a shared phone never shows a cached photo to the next user. Report details (`/reports/:id`, `/team/reports/:id`, `/admin/reports/:id`) include `photos: [{ id, dateUploaded }]`.

**GET `/reports/:id`** → `{ report: { id, issueType, location, description, dateSubmitted, status, resolutionNotes, hasFeedback, feedback } }`
Not my report → `403 FORBIDDEN`; does not exist → `404`.

**POST `/reports/:id/feedback`**
Body: `rating` (whole number 1–5, required), `comments` (optional, up to 500 characters).
Not Resolved → `409 REPORT_NOT_RESOLVED`; already rated → `409 FEEDBACK_EXISTS`; another resident's report → `403`.

**GET `/resident/notifications`** → `{ notifications: [{ id, reportId, reportDateSubmitted, message, dateSent, status }], unreadCount }`
**PATCH `/notifications/:id/read`** and **PATCH `/notifications/read-all`** return the new `unreadCount`.

### Profile (all roles)

**GET / PUT `/profile`** — the account always comes from the token, never from the body, so each user can only edit their own profile. The username cannot be changed.

| Role | Editable fields |
|---|---|
| Resident | `name`, `address`, `contactInfo` |
| Response Team | `teamName`, `assignedArea`, `contactInfo` |
| LGU | `departmentName`, `officerInCharge`, `contactInfo` |

**PUT `/profile/password`** — body: `currentPassword`, `newPassword` (8–72, different from the current one), `confirmPassword`. Wrong current password → `400 WRONG_CURRENT_PASSWORD`. On success → `{ code: "PASSWORD_CHANGED", token }`: the `token_version` goes up, so every older token stops working (other devices are logged out), and the returned `token` keeps this session going.

### Response Team

**GET `/team/reports`** — query parameters (all optional):

| Parameter | Example | Notes |
|---|---|---|
| `search` | `#2026-0013`, `13`, `Purok 3` | report ID or part of the location |
| `issueType` | `Flooding` | one of the four issue types |
| `status` | `In Progress` | one of the four statuses |
| `dateFrom`, `dateTo` | `2026-09-01` | `YYYY-MM-DD`; `dateTo` includes the whole day |
| `overdue` | `1` | only overdue reports |
| `page` | `2` | 10 reports per page |

Shows **only reports assigned to this team** (never unassigned or other teams' reports). Returns `{ reports, total, page, pageSize, totalPages }`; each report includes `area`, `priority` and `isOverdue`.

**PATCH `/team/reports/:id`**
Body: `status` (must be exactly the next status: **Under Review → In Progress → Resolved**), `resolutionNotes` (required when setting `Resolved`, up to 2000 characters).
Teams never set *Under Review*: that happens when the LGU assigns the report. Every update creates a notification for the resident, e.g. "Your report #2026-0101 on Flooding is now In Progress."
Report not assigned to this team (including unassigned ones) → `403 NOT_ASSIGNED_TO_TEAM`; wrong next status → `409 INVALID_STATUS_CHANGE`; Resolved without notes → `400 NOTES_REQUIRED`.

### Overdue reports

A report is **overdue** when its status is not *Resolved* and it was submitted more than `OVERDUE_DAYS` (7, `server/config/rules.js`) days ago. It is calculated inside each SQL query (`overdueSql()` in `server/services/smartRules.js`), never stored, so it is always current. **Every report in every response** (resident, team and LGU lists and details, dashboard recent reports, Generate Reports rows, new reports) includes `isOverdue: true | false`. The lists accept `overdue=1` ("Overdue only"): `/team/reports`, `/admin/reports`, `/admin/reports/export`. A value other than `1`, `0`, `true`, `false` → `400 INVALID_FILTER`.

**GET `/alerts/overdue`** → `{ total, overdueDays, reports: [{ id, issueType, area, priority, location, dateSubmitted, status, teamName, daysOpen, isOverdue }] }`, oldest first. LGU: all overdue reports (including unassigned ones). Response team: only the reports assigned to it. Residents → `403`.

### Help and Support

**GET `/chat/status`** (any logged-in account) →
```json
{
  "timeZone": "Asia/Manila",
  "now": { "date": "2026-10-26", "time": "09:30:00", "dayOfWeek": 1 },
  "isOpenNow": true,
  "today": { "date": "2026-10-26", "dayOfWeek": 1, "isOpen": true, "start": "08:00", "end": "17:00", "source": "weekly" },
  "nextOpening": null,
  "availableStaff": 2
}
```
- Always in **Asia/Manila** time. `dayOfWeek`: 1 = Monday … 7 = Sunday.
- `isOpenNow`: today is open and `start` ≤ now < `end` (open at 08:00, closed from 17:00).
- `today.source`: `weekly` (the weekday row), `special` (a `specific_date` row such as a holiday, which overrides the weekly row), or `none` (no row: closed).
- `nextOpening`: `{ date, dayOfWeek, start, end }` of the next time chat opens (later today, or the next open day within 60 days), or `null` while it is open.
- `availableStaff`: LGU and response team accounts with `chat_availability = 'Available'`.

**POST `/chatbot/start`** (residents) — body `{ "sessionId": 12 }` (optional). Continues the resident's own chatbot session, or starts a new one (`chat_session.status = 'Bot'`) and saves the greeting. → `{ sessionId, menu: ["howToReport", "whatToReport", "myStatus", "schedule", "emergency", "talkToStaff"], resumed }`

**POST `/chatbot/message`** (residents) — body `{ "sessionId": 12, "option": "myStatus" }` (a menu button) or `{ "sessionId": 12, "text": "Ano ang estado ng ulat ko?" }` (typed, up to 500 characters; matched by the keywords in `server/config/chatbotRules.js`). Saves the resident's message and the answer in `chat_message`. → `{ sessionId, reply: { intent, data } }`
- `intent`: a menu id, or `unknown` (no keyword matched: the client shows "Sorry, I didn't understand…" and the menu again).
- `data`: `myStatus` → `{ reports }` (the resident's 5 latest: `id, issueType, status, dateSubmitted, isOverdue` — never other residents' reports); `schedule` and `talkToStaff` → `{ chat }` (same as `GET /chat/status`); `emergency` → `{ hotlines }` (exactly the same list as `GET /public/hotlines`); others → `{}`.
- Stored messages are language-neutral: a menu click is saved as `option:<id>`, a bot answer as `intent:<id>` (e.g. `intent:greeting`, `intent:unknown`), typed text as typed.
- Errors: another resident's or an ended session → `404 CHAT_SESSION_NOT_FOUND`; unknown option, empty or too long text → `400 VALIDATION_FAILED`; response teams and LGU → `403`.

### Live chat

Session status: `Bot` → `Waiting` → `Active` → `Closed`, or `Bot` → `Message Left` → `Closed` (after a staff reply). Every step is also saved in `chat_message` as a bot "status" line: `status:waiting` (the queue order is this message's id), `status:accepted` (the reply countdown starts here), `status:ended:resident` / `status:ended:staff`, `status:message-left`, and `rating:1` … `rating:5`.

**POST `/livechat/request`** (residents) — body `{ "sessionId": 12 }` (optional: the chatbot session). Only during the Chat Schedule **and** with at least one Available staff member; otherwise `409 LIVE_CHAT_CLOSED` with `chat` (same as `GET /chat/status`, including `nextOpening`). Asking again while waiting returns the same place in the queue. → `{ session: { id, status: "Waiting", position, … }, messages }`

**POST `/livechat/leave`** (residents) — body `{ sessionId?, text }` (1–1000 characters). Saves the message with status `Message Left`. → `201 { leftMessages }`

**GET `/livechat/current`** (residents) → `{ session | null, messages, leftMessages: [{ sessionId, text, dateSent, replyText, replyDate, staffName }] }` (left messages of the last 30 days).

**POST `/livechat/sessions/:id/accept`** (staff, must be Available) — body `{ "estimatedWaitMinutes": 5 | 10 | 15 | 30 }`. The row is locked in a transaction, so if two staff accept at the same moment only the first succeeds; the other gets `409 CHAT_ALREADY_ACCEPTED`. Away staff → `403 STAFF_AWAY` (the same for `GET /livechat/queue`).

**POST `/livechat/sessions/:id/reply`** (staff) — body `{ text }`. Answers a message left: saves the reply, closes the session, and creates the notification "A staff member replied to your message." (`notification.chat_session_id`, no report) — all in one transaction. A second answer → `409 MESSAGE_ALREADY_ANSWERED`.

**POST `/livechat/sessions/:id/messages`** — body `{ text }` (1–1000). Residents may write while Waiting or Active, staff only when Active; otherwise `409 CHAT_NOT_OPEN`. Someone else's chat → `404 CHAT_SESSION_NOT_FOUND`.

**POST `/livechat/sessions/:id/rating`** (residents) — body `{ "rating": 1-5 }`, only after the chat ended and only once (`409 CHAT_NOT_ENDED` / `CHAT_ALREADY_RATED`). Saved as the bot message `rating:N`.

**Socket.IO events** (the API saves first, then pushes):

| Event | To | Data |
|---|---|---|
| `live:queue` | Available staff | the queue changed → reload `GET /livechat/queue` |
| `live:left` | all staff | messages left changed → reload `GET /livechat/messages-left` |
| `live:position` | the waiting resident | `{ sessionId, position }` |
| `live:accepted` | the resident | `{ session }` (staff name, minutes, countdown start) |
| `live:message` | resident and staff of the chat | `{ sessionId, message: { id, sender, message, dateSent } }` |
| `live:typing` | the other person | `{ sessionId, from }` — sent by a client as `live:typing { sessionId }` |
| `live:ended` | resident and staff of the chat | `{ sessionId, by }` |
| `live:reply` | the resident | a staff member answered their left message |

**Real-time connection (Socket.IO)** on the API port: `io('http://localhost:5000', { auth: { token } })` (or through the Vite proxy at `/socket.io`). The token is checked exactly like the REST API (valid JWT, account exists, token version is current — not logged out since — and the account is Active). `POST /auth/logout` closes the account's open connections. Refused connections get a `connect_error` whose `message` is `UNAUTHORIZED`, `SESSION_EXPIRED`, or `ACCOUNT_INACTIVE`. Each connected socket joins the rooms `user:<role>:<id>` and `role:<role>`.

### Chat Schedule (LGU)

Uses the `chat_schedule` table (see `GET /chat/status`). Every answer returns the whole schedule so the page can redraw it:
`{ weekly: [{ dayOfWeek, isOpen, start, end }] (7 days, Monday first), special: [{ id, date, isOpen, start, end }] (today and later, soonest first), status }` where `status` is the same as `GET /chat/status`. Times are `HH:MM` (24-hour), Asia/Manila. A weekday with no row is shown as closed 08:00–17:00.

**GET `/admin/chat-schedule`** → the schedule.

**PUT `/admin/chat-schedule/weekly`** — body `{ "days": [{ "dayOfWeek": 1, "isOpen": true, "start": "08:00", "end": "17:00" }, …] }` with **all 7 days, once each** (otherwise `fields.days = "INVALID_SCHEDULE"`). An open day needs valid times with start before end (`fields.day<N>` = `INVALID_TIME` / `INVALID_TIME_RANGE`); a closed day keeps its times. Saved in one transaction (one row per weekday).

**POST `/admin/chat-schedule/special`** — body `{ "date": "2026-12-25", "isOpen": false }` (closed all day) or `{ "date": "2026-12-24", "isOpen": true, "start": "08:00", "end": "12:00" }` (different hours). The date may not be in the past (Manila): `fields.date` = `FIELD_REQUIRED` / `INVALID_DATE` / `DATE_IN_PAST`; bad hours → `fields.end` = `INVALID_TIME` / `INVALID_TIME_RANGE`. The same date again replaces the earlier entry. A special date overrides the weekly hours for that day.

**DELETE `/admin/chat-schedule/special/:id`** → the schedule; unknown id (or a weekly row) → `404 NOT_FOUND`.

Validation errors are `400 VALIDATION_FAILED` with `fields`. Response teams → `403`.

### Staff notifications (the bell)

Table `staff_notification`: one row per recipient account (`recipient_role` + `recipient_id`). The text is not stored; the client builds it in English or Tagalog from `type`, the report, and `detail`:

| `type` | Sent to | When |
|---|---|---|
| `new_report` | every LGU account | a resident submits a report |
| `assigned` | the response team | the LGU assigns (or reassigns) a report to it |
| `status_changed` | every LGU account | a team moves a report to In Progress or Resolved (`detail` = the new status) |
| `message_left` | every LGU and response team account | a resident leaves a message outside the Chat Schedule (`chatSessionId` set) |

**GET `/staff/notifications`** → `{ notifications: [{ id, type, reportId, chatSessionId, reportDateSubmitted, issueType, detail, dateSent, status }], unreadCount }` (newest 30).

**PATCH `/staff/notifications/:id/read`** → `{ id, status: "Read", unreadCount }`; someone else's or unknown → `404 NOT_FOUND`.

**PATCH `/staff/notifications/read-all`** → `{ updated, unreadCount: 0 }`.

Residents → `403` (residents use `/resident/notifications`).

### Contact and hotlines (public, landing page)

**GET `/public/contact`** (no login) → `{ contact: { address, phone, phoneTel, email, facebook, officeHours }, chat: { isOpenNow, today: { isOpen, start, end } } }`, from `server/config/contact.js`. A field containing `[REPLACE]` is left out; `[CONFIRM]` is removed from the text. `chat` is today's live chat hours from the Chat Schedule (the same data as `GET /chat/status`, which needs a login).

**GET `/public/hotlines`** (no login) → `{ hotlines: [{ id, name, number, tel, mobile: [{ number, tel }], address?, verified }] }`, from `server/config/hotlines.js`. Rules (`server/services/publicInfo.js`, Jest tests in `publicInfo.test.js`): **911 first**; entries whose number is `"[REPLACE]"` are left out; `verified: false` → the client shows "To be confirmed" / "Kinukumpirma pa"; `tel` is `tel:` plus the digits only (each mobile number has its own); the developer fields `note` and `source` are never sent. The chatbot `emergency` answer uses the same list. At startup the server prints a warning listing every unverified or `[REPLACE]` hotline.

### Hotspots

**GET `/hotspots`** → `{ days, minReports, hotspots: [{ area, total, byIssueType: { "Waste Disposal": 2, "Pollution": 0, "Flooding": 3, "Other Hazard": 0 }, topIssueType }] }`.
Every area with `HOTSPOT_COUNT` (5) or more reports (any status) submitted in the last `HOTSPOT_DAYS` (30) days, highest total first (then area name). `topIssueType` is the most common issue type (a tie goes to the first in the list Waste Disposal, Pollution, Flooding, Other Hazard). LGU: every area. Response team: only the areas in its `assigned_area`. Residents → `403`. Rules: `buildHotspots()` / `findHotspots()` in `server/services/smartRules.js`.

### Dashboards

**GET `/dashboard/summary`** → `{ scope, total, byStatus, byIssueType, byMonth: { year, counts[12] }, recentReports }`
Response team: only the reports assigned to it. LGU: all reports, plus `unassigned` (number of reports with no team; `null` for a team).

### LGU / Administrator

**GET `/admin/users`** — query: `role` (`resident` · `response_team`), `status` (`Active` · `Inactive`, residents only), `search` (name or username).

**POST `/admin/teams`** — body: `teamName`, `assignedArea`, `contactInfo`, `username`, `password`, `confirmPassword`. Username must be unused in all account tables.

**PUT `/admin/teams/:id`** — body: `teamName`, `assignedArea`, `contactInfo`.

**PATCH `/admin/residents/:id/status`** — body: `{ "status": "Active" | "Inactive" }`. Takes effect immediately, including for a resident who is already logged in.

**GET `/admin/reports`** — query: `status`, `priority` (High/Medium/Low), `area` (Purok 1–7), `issueType`, `unassigned=1` (only reports with no team), `overdue=1` (only overdue reports), `page`. Sorted by priority (High → Medium → Low), then oldest first. → `{ reports: [{ id, issueType, area, priority, location, description, dateSubmitted, status, teamId, teamName }], total, unassignedTotal, page, pageSize, totalPages }`. A wrong filter value → `400 INVALID_FILTER`.

Report details (`/reports/:id`, `/team/reports/:id`, `/admin/reports/:id`) include `linkedReports: [{ id, displayId }]`: the report this one is similar to AND newer reports similar to it, limited to reports the user may open (LGU all, team its own, resident their own).

**GET `/admin/reports/:id`** → `{ report: { …, area, priority, similarToReportId, linkedReports, teamName, residentName }, teams: [{ id, teamName, assignedArea, coversArea }] }`. `coversArea` is `true` for the team whose `assigned_area` includes the report's area (the suggested team).

**PATCH `/admin/reports/:id/assign`** — body: `{ "team_id": 1 }` (`teamId` is also accepted).
- *Submitted* report → the team is set and the status becomes **Under Review** automatically; the resident gets "Your report #2026-0101 has been assigned to Response Team 1 and is now Under Review."
- *Under Review* / *In Progress* → moved to the other team; status unchanged, no notification.
- *Resolved* → `409 REPORT_ALREADY_RESOLVED`. Unknown team → `400 TEAM_NOT_FOUND`.

### Featured Resolved Cases (landing page)

Table `featured_case`: `report_id` (UNIQUE — a report is featured once), `caption` (≤ 200), `after_photo_path` (`featured/<random>.jpg|png` under `server/uploads/`), `display_order`, `is_visible`, `date_featured`, `lgu_id`.

**GET `/public/resolved-cases`** (no login) → `{ cases: [{ caption, issueType, area, dateResolved, photoUrl }] }` — only cases that are **Visible and whose report is Resolved**, ordered by `display_order`, at most **10**. Nothing else is sent: no resident name, username or contact, no street/landmark or description, no report ID, and never the resident's own report photos (`photoUrl` is `/api/public/resolved-cases/:id/photo`, the LGU "after" photo). `dateResolved` is the date of the report's "… is now Resolved." notification.

**GET `/public/resolved-cases/:id/photo`** (no login) — the image while the case is shown publicly; hidden, removed or unresolved → `404`. Sent with `Cache-Control: no-cache`.

**POST `/admin/featured-cases`** — `multipart/form-data`: `reportId`, `caption` (required, 1–200 characters), `photo` (exactly one JPG/PNG, ≤ `MAX_PHOTO_MB`; the real file type is checked like report photos). Added at the end of the slideshow, Visible. → `201 { featured: { id, reportId, caption, displayOrder, isVisible, dateFeatured, issueType, area, status, dateResolved, photoUrl } }`. Errors: report not Resolved → `409 FEATURE_NOT_RESOLVED`; already featured → `409 ALREADY_FEATURED`; `400 VALIDATION_FAILED` with `fields.caption` = `CAPTION_REQUIRED` / `CAPTION_TOO_LONG` or `fields.photo` = `PHOTO_REQUIRED`; `400 INVALID_PHOTO_TYPE`, `PHOTO_TOO_LARGE`, `ONE_PHOTO_ONLY`.

**PUT `/admin/featured-cases/:id`** — multipart: `caption` (required), `photo` (optional; replaces the old file, which is deleted).

**PATCH `/admin/featured-cases/:id/visibility`** — `{ "isVisible": true | false }`. Showing a case whose report is not Resolved → `409 FEATURE_NOT_RESOLVED`.

**PATCH `/admin/featured-cases/:id/move`** — `{ "direction": "up" | "down" }`: swaps with its neighbour (the order is renumbered 1, 2, 3…). → `{ cases }` (the whole list in the new order).

**DELETE `/admin/featured-cases/:id`** → `204` (the report itself is not changed).

**Automatic hiding:** before every list (`GET /admin/featured-cases`, `GET /public/resolved-cases`) cases whose report is no longer Resolved get `is_visible = 0`; they stay hidden until the LGU shows them again (after the report is Resolved again). `GET /admin/reports/:id` also returns `featured` (the report's case or `null`) and `dateResolved`.

**GET `/admin/performance`** → `{ total, byStatus, byIssueType, teams: [{ teamName, assigned, underReview, inProgress, resolved, resolutionRate }], unassigned, resolutionRate }`. Resolution rate = Resolved ÷ Total (e.g. `0.373` = 37.3%).

**GET `/admin/reports/export`** — query: `dateFrom`, `dateTo`, `issueType`, `status`, `overdue=1`, and optionally `format=csv`. The JSON answer also has `hotspots` (same shape as `GET /hotspots`, all areas, always the last 30 days, not the date filters). The CSV file ends with an empty line and the hotspot table: *Rank, Area, Total Reports, Most Common Issue Type, Waste Disposal, Pollution, Flooding, Other Hazard* ("No hotspots right now" when empty).
- JSON: `{ filters, summary: { total, byStatus, byIssueType, byMonth }, rows }`. The summary is computed from the rows, so `summary.total` always equals the number of rows.
- Rows include `area` and `priority`.
- CSV (`format=csv`): a file download (columns: Report ID, Date Submitted, Issue Type, Area, Priority, Location, Description, Status, Assigned Team, Resident, Resolution Notes) (`landayan-reports-YYYY-MM-DD.csv`) with UTF-8 BOM, every value quoted, Windows line endings, and formula-like values (starting with `=`, `+`, `-`, `@`) prefixed with `'` so Excel shows them as text.

---

## Security notes

- Passwords are stored only as **bcrypt** hashes (10 rounds).
- Every SQL query uses **`?` placeholders** (parameterized); user input is never joined into SQL text.
- Report, notification, feedback, and status updates that must happen together run in **database transactions**; the row is locked so double-clicks and two teams saving at once cannot create duplicates or conflicts.
- Invalid JSON, wrong types, very long text, and unknown IDs return a clear `4xx` error; the server keeps running.
- The only data shown without login is on the landing page (`/public/…`): the slideshow (LGU-written captions, issue type, area, date resolved and the LGU "after" photos), the barangay's contact details, and the emergency hotlines. Resident data and residents' report photos are never public.
- Logging out (`POST /auth/logout`) and changing the password end the account's other sessions right away (`token_version`), on the REST API and Socket.IO.
- Residents must agree to the Data Privacy Notice (RA 10173) to register; the date is saved in `resident.consent_date`.
