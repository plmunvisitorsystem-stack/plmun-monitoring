# Smart Environmental Reporting and Community Response System

**Barangay Landayan, San Pedro City, Laguna** — BSIT Capstone Project

Residents report environmental concerns (waste disposal, pollution, flooding, other hazards). Response teams receive the reports and update their status. The LGU / Administrator monitors performance, manages accounts, and generates printable reports. The whole interface is available in **English and Tagalog**.

| Part | Technology |
|---|---|
| `client/` | React (Vite), React Router, Chart.js (react-chartjs-2) |
| `server/` | Node.js, Express REST API, JWT login, bcrypt passwords |
| `database/` | MySQL (MariaDB in XAMPP) — `schema.sql`, `seed.sql` |

Other documents: **[API.md](API.md)** (every endpoint) and **[ALPHA_TEST.md](ALPHA_TEST.md)** (test cases and results).

---

## 1. Requirements

- Windows 10 or 11
- **XAMPP** (includes MySQL/MariaDB and phpMyAdmin) — https://www.apachefriends.org
- **Node.js 18.11 or newer** (tested with Node.js 24) — https://nodejs.org (choose the LTS version)
- Google Chrome or Microsoft Edge

---

## 2. Set up the database (XAMPP + phpMyAdmin)

1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **Apache** and **MySQL**. Both turn green.
   (Apache is only needed for phpMyAdmin; the system itself does not use it.)
3. Open **http://localhost/phpmyadmin** in your browser.
4. Click the **Import** tab at the top.
5. Click **Choose File**, select **`database/schema.sql`**, then click **Import** (or **Go**) at the bottom.
   This creates the database `landayan_ers` and its twelve tables (already up to date: no migrations needed on a new install).
6. Click the **Import** tab again, choose **`database/seed.sql`**, and click **Import**.
   This adds the test accounts and 48 sample reports (with areas, priorities, and assigned teams). Report **#2026-0037** (In Progress, Response Team 1) is always dated 8 days before the import, so the **overdue** alert can be seen right away.
7. Check: in the left panel, open `landayan_ers` → `report`. You should see 48 rows.

> ⚠️ **Importing `schema.sql` deletes all existing data** in `landayan_ers`. Import `seed.sql` again at any time to reset the sample data.
>
### Upgrading an existing database (keep your data)

If you imported an older `schema.sql` and want to **keep your data**, do **not** re-import the schema. Back up first (phpMyAdmin → `landayan_ers` → **Export** → **Go**), then stop the server and import the migrations **in this order** (phpMyAdmin → **Import**). Each one is safe to run twice, so if you are not sure which ones you already ran, run them all from the start:

| Order | File | What it adds |
|---|---|---|
| 1 | `database/migration_v2.sql` | Report **area**, **priority**, and **similar report** columns and the **report_photo** table; fills them in for existing reports and gives every report past *Submitted* a team |
| 2 | `database/migration_v3.sql` | Help and Support: chat tables, staff chat availability, default Chat Schedule |
| 3 | `database/migration_v4.sql` | Notifications for live chat replies, and the `featured_case` table (landing page slideshow). If you ran an earlier v4, run it again to add `featured_case`. |
| 4 | `database/migration_v5.sql` | `staff_notification` table (the bell for LGU and response team accounts) |
| 5 | `database/migration_v6.sql` | `resident.consent_date` (Data Privacy consent) and `token_version` on all account tables (logout ends the session). **Everyone must log in again once after this.** |

Without v5 the bell and every new report fail; without v6 nobody can log in.

> ⚠️ Always stop MySQL with the **Stop** button in XAMPP. Closing it any other way (Task Manager, shutting down the PC while it runs) can corrupt the database.

---

## 3. Set up and start the server (API)

Open a terminal (PowerShell or Command Prompt):

```
cd landayan-reporting\server
copy .env.example .env
npm install
```

Open `server\.env` in a text editor and set **`JWT_SECRET`** to a long random text. You can generate one with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The other values already match a default XAMPP installation:

| Setting | Default | Change it if… |
|---|---|---|
| `PORT` | `5000` | another program uses port 5000 |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL runs elsewhere |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* | you set a MySQL password |
| `DB_NAME` | `landayan_ers` | you renamed the database |
| `JWT_EXPIRES_IN` | `8h` | you want logins to last longer or shorter |
| `CLIENT_ORIGIN` | `http://localhost:5173` | the client runs on another address |

Start the server:

```
npm run dev
```

You should see:

```
API server running at http://localhost:5000
Database: connected
```

Check it in the browser: **http://localhost:5000/api/health** → `{"status":"ok","database":"connected"}`.
Keep this terminal open.

---

## 4. Set up and start the client (website)

Open a **second** terminal:

```
cd landayan-reporting\client
npm install
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge. The Login page appears.

> Both terminals (server and client) must stay open while you use the system.

> ⚠️ **Windows: stop the server and the client (Ctrl + C in both terminals) before running `npm ci`** (a clean reinstall). `npm ci` first deletes `node_modules`; Windows refuses to delete files that a running server or Vite is using, so the reinstall stops halfway and leaves `node_modules` broken. If that happens, stop both, then run `npm install` in `server` and in `client`. (`npm install` is safe while they run.)

---

## 5. Test accounts

All accounts use the password **`Password123!`** (test data only: see **Before real use**, section 10).

| Role | Username | Lands on | Notes |
|---|---|---|---|
| LGU / Administrator | `admin` | `/admin/dashboard` | Ana Villanueva, Barangay Landayan Environment Office |
| Response Team | `team1` | `/team/dashboard` | Response Team 1 — Purok 1, 2, 3 |
| Response Team | `team2` | `/team/dashboard` | Response Team 2 — Purok 4, 5, 6, 7 |
| Resident | `juan` | `/home` | Juan Dela Cruz — 16 reports |
| Resident | `maria` | `/home` | Maria Santos — 16 reports |
| Resident | `pedro` | `/home` | Pedro Reyes — 16 reports |

New residents can create their own account with **Create Account** on the Login page. New response team accounts are added by the LGU in **Manage Users → Add User**.

---

## 6. What each role can do

**Visitors (not logged in)** — the **landing page** at `http://localhost:5173/`: the system name, **Log In**, **Create Account**, and a **Resolved Cases** slideshow of the cases the LGU featured (caption, issue type, area, date resolved, and an "after" photo; never the resident's name, details or own photos). It refreshes every 30 seconds and whenever the tab is opened again. Logged-in users who open `/` go to their own home page.

**Resident** (phone layout with bottom navigation)
- Home: greeting, **Report a Concern**, latest reports
- Submit a report (issue type, **area/purok**, street or landmark, description, and up to **5 photos** from the camera or gallery) and get a reference number like `#2026-0049`
- Report Details with a status timeline (Submitted → Under Review → In Progress → Resolved)
- Notifications with an unread badge; tapping one opens the report
- Feedback (1–5 stars) after a report is resolved
- Profile: edit details, change password, log out

**Response Team** (desktop layout with sidebar)
- Dashboard: totals, charts, recent reports — **only reports assigned to the team**
- Reports List: search, filters, 10 per page — **only reports assigned to the team**
- Update status **Under Review → In Progress → Resolved**, one step at a time, with resolution notes (required for Resolved); the resident is notified
- Profile

**LGU / Administrator** (desktop layout with sidebar)
- Dashboard for all reports
- Dashboard shows the number of **unassigned reports** with an "Assign Reports" button
- **Reports**: every report, High priority and oldest first, with filters (status, priority, area, issue type, *Unassigned only*). **Assign** opens a dialog with the report details, the **Suggested Team** (the team whose area includes the report's purok), a list of all teams, and **Confirm Assignment**. Assigning a *Submitted* report sets it to **Under Review** and notifies the resident ("…has been assigned to [team] and is now Under Review."). A report can be moved to another team until it is Resolved.
- Manage Users: list residents and teams, add/edit team accounts, activate/deactivate residents
- Performance: resolution rate overall and per team
- Generate Reports (`/admin/generate-reports`): filters, summary, charts, **Print Report**, **Export CSV**
- **Featured Cases** (landing page slideshow): on a **Resolved** report's details, **Feature on Landing Page** opens a form with a **caption** (required, up to 200 characters, English), one **"after" photo** (JPG/PNG, up to 5 MB, checked like report photos) and a **preview** of the public slide. The **Featured Cases** page lists them in slideshow order with thumbnail, caption, **Visible / Hidden** switch, **Up / Down**, **Edit** and **Remove** (with confirmation). At most 10 visible cases are shown publicly. If a featured report is somehow no longer Resolved, it is **hidden automatically** (and cannot be shown again until it is Resolved).
- Profile

### Report status flow

```
Submitted ──(LGU assigns a team)──► Under Review ──(team)──► In Progress ──(team)──► Resolved
```

Statuses only move forward. Response teams cannot assign reports to themselves.

### Areas and smart rules (rule-based, no AI)

| File | What you can change |
|---|---|
| `server/config/areas.js` | The list of areas (puroks) residents choose from. Currently placeholders *Purok 1* to *Purok 7*. Also served at `GET /api/areas`. Team `assigned_area` values should use the same names. |
| `server/config/rules.js` | `SIMILAR_DAYS=3`, `PRIORITY_RAISE_COUNT=3`, `PRIORITY_RAISE_DAYS=7`, `OVERDUE_DAYS=7`, `HOTSPOT_COUNT=5`, `HOTSPOT_DAYS=30`, `MAX_PHOTOS=5`, `MAX_PHOTO_MB=5` |

The rules themselves are in `server/services/smartRules.js` (with Jest unit tests):

- **Base priority** per issue type: Flooding **High**; Pollution and Other Hazard **Medium**; Waste Disposal **Low**.
- **Raise:** when a report is submitted, the system counts the reports with the **same issue type in the same area** from the last `PRIORITY_RAISE_DAYS` days (including the new one). At `PRIORITY_RAISE_COUNT` or more, the priority goes up **one level** (Low → Medium → High, never above High) for the new report **and** the other unresolved matching reports. Example: 3 Waste Disposal reports in Purok 2 within 7 days → all three Medium. Flooding is always High.
- **Similar report:** on the Report page, once an issue type and area are chosen, the resident sees "A similar report was already submitted in this area on [date]. You can still submit your report." when an **unresolved** report of the same type and area was sent in the last `SIMILAR_DAYS` days. The new report is saved with `similar_to_report_id` pointing to it, and both details pages show "Linked to similar report #2026-####" (only to users who may open the other report).
- **Priority badge:** an outlined pill with a flag icon (High red, Medium amber, Low gray-green) on the LGU and team lists and details pages.
- **Overdue:** a report is overdue when it is not Resolved and was submitted more than `OVERDUE_DAYS` (7) days ago. It is calculated in every query (never stored), so it is always current and stops the moment the report is Resolved. Overdue reports get a red **Overdue** / *Lampas na sa takdang araw* tag next to their status in every list and details page; every list can be filtered with **Overdue only**. The team and LGU dashboards show a red alert at the top, "[number] overdue reports need attention", with **View** (hidden when there are none). A team only ever sees its own overdue reports.

- **Hotspots:** an area with `HOTSPOT_COUNT` (5) or more reports in the last `HOTSPOT_DAYS` (30) days. The card **Hotspots (last 30 days)** / *Mga Hotspot (huling 30 araw)* ranks them by total, with the most common issue type and a bar. The LGU sees it on the Dashboard and in Generate Reports (also printed and in the CSV export); a response team sees only hotspots inside its assigned area. With no hotspots it shows "No hotspots right now".

Restart the server after editing either file. After changing a priority number, run `npm run recalc-priorities` in `/server` to see which existing reports would change, and `npm run recalc-priorities -- --save` to update them.

**Unit tests:** in `/server` run `npm test` (Jest, no database needed).

### Help and Support (chatbot and live chat)

- **Chatbot:** rule-based only (menu options and keywords, no AI), in English and Tagalog. Residents open it with the floating **Help** / *Tulong* button (above the bottom navigation on every resident page). Menu: How to submit a report · What can I report? · Check my report status (their 5 latest reports) · Live chat schedule · Emergency (hotlines) · Talk to staff. Typed questions are matched by keywords; anything else gets "Sorry, I didn't understand…" and the menu again. **Edit the menu and keywords in `server/config/chatbotRules.js`** (matcher: `server/services/chatbot.js`, Jest tests in `chatbot.test.js`); the answer texts are in `en.json` / `tl.json` under `chatbot`. Every conversation is saved in `chat_session` (status *Bot*) and `chat_message`.
- **Live chat staff:** any LGU or response team account that sets itself **Available** (`chat_availability`, default *Away*).
- **Chat Schedule** (table `chat_schedule`, always **Asia/Manila** time): live chat is open only during it. Default: **Monday–Friday, 8:00 AM–5:00 PM**; Saturday and Sunday closed. Weekly rows use `day_of_week` (1 = Monday … 7 = Sunday); a row with a `specific_date` (e.g. a holiday) overrides the weekly row for that date. The rules are in `server/services/chatSchedule.js` (Jest tests in `chatSchedule.test.js`).
- **Emergencies are not handled in chat.** The bot's **Emergency** answer and the landing page **Emergency Hotlines** box show the hotlines in **`server/config/hotlines.js`** (same data: `GET /api/public/hotlines`). Rules: **911 is always first**; an entry whose number is `"[REPLACE]"` is hidden; an entry with `verified: false` shows a gray **To be confirmed** / *Kinukumpirma pa* label; every number (and each mobile number) is a tap-to-call link; `note` and `source` are for developers only and are never shown. The server prints a **WARNING** at startup listing every hotline that is unverified or `[REPLACE]`. Contact details for the landing page are in **`server/config/contact.js`** (`[REPLACE]` fields are hidden; `[CONFIRM]` is shown without the marker). Restart the server after editing either file. See **Before real use** (section 10).
- **Live chat (residents):** "Talk to staff" during open hours puts the resident in the queue: "Waiting for available staff… You are number N in line." (updates in real time). When a staff member accepts: "[Staff] will reply in about X minutes" with a countdown, then the chat with times and "typing…". Outside the schedule, or when no staff is Available: "Live chat is closed. Next available: [day, time]." and a **Leave a Message** box. After the chat, an optional 1–5 star rating (saved as a bot message).
- **Live chat (staff):** **Live Chat** in the LGU and team sidebars, with an **Available / Away** switch. Only Available staff get the queue (oldest first, in real time). **Accept** asks for the estimated reply time (5, 10, 15 or 30 minutes); only one staff member can accept a chat. The chat window shows the resident's latest reports, quick replies, and **End Chat**. **Messages Left** lists messages left outside the schedule; a reply appears in the resident's Help panel and creates a notification.
- **Real time:** Socket.IO on the same port as the API (5000). The client connects with its login token; invalid, expired, or deactivated accounts are refused. In development the client reaches it through the Vite proxy (`/socket.io`).

The **EN | TL** switch (or the language dropdown on Login/Register) changes every text immediately; the choice is remembered.

---

## 7. Useful commands

| Where | Command | What it does |
|---|---|---|
| `server` | `npm run dev` | Start the API (restarts automatically when code changes) |
| `server` | `npm start` | Start the API without auto-restart |
| `server` | `npm run hash -- "NewPassword1"` | Print a bcrypt hash (for adding accounts by hand) |
| `client` | `npm run dev` | Start the website |
| `client` | `npm run build` | Build the website for deployment (into `client/dist`) |

To stop: press **Ctrl + C** in each terminal, then click **Stop** for MySQL (and Apache) in XAMPP.

---

## 8. Troubleshooting

| Problem | Solution |
|---|---|
| **"Cannot reach the server"** on the Login page | The API is not running. Start it in a terminal: `cd server` → `npm run dev`. |
| Server says **"Database: NOT connected"** | Start MySQL in XAMPP, and make sure `schema.sql` was imported. Check `DB_*` values in `server\.env`. |
| Server stops with **"JWT_SECRET is missing"** | Set `JWT_SECRET` in `server\.env` (see step 3). |
| MySQL turns red right after **Start** in XAMPP | Click **Logs** in XAMPP. If another MySQL program uses port 3306, stop it. If MySQL was closed incorrectly, restore from a backup — and next time always use **Stop**. |
| **"Wrong username or password"** for a test account | Someone changed that account's password. Re-import `seed.sql` to reset all sample data. |
| **"Your account is inactive"** | The LGU deactivated this resident. Log in as `admin` → Manage Users → **Activate**. |
| Port 5000 or 5173 already in use | Close the other terminal that runs it, or change `PORT` in `.env` (and the proxy in `client/vite.config.js`). |
| The page looks unstyled or outdated | Refresh with **Ctrl + F5**. |
| "Take Photo" opens the file picker instead of the camera | The camera opens on phones (Android/iPhone browsers). On a computer it opens the file picker. |
| XAMPP: MySQL "shutdown unexpectedly"; the log `C:\xampp\mysql\data\mysql_error.log` says "Aria recovery failed" | MySQL was not stopped before the PC turned off. Back up `C:\xampp\mysql\data` first, move `aria_log.00000001` and `aria_log_control` out of that folder, run `C:\xampp\mysql\bin\aria_chk.exe -r mysql\*.MAI` (use `-o` for any table it cannot fix) inside the data folder, then Start MySQL again. Always click **Stop** in XAMPP before shutting down. |
| Photos missing after moving the project to another PC | Copy `server/uploads/` (both `reports/` and `featured/`) together with the database; the database only stores the file names. |
| The landing page says "Resolved cases will appear here soon." | No case is featured and Visible yet: as the LGU, open a Resolved report → **Feature on Landing Page**, or switch a case to **Visible** on **Featured Cases**. |

---

## 9. Project structure

```
landayan-reporting/
├── README.md, API.md, ALPHA_TEST.md
├── DEPLOY.md               ← put the system online for free (Render + Aiven + Cloudinary)
├── render.yaml             ← Render settings used by DEPLOY.md
├── database/
│   ├── schema.sql          ← tables, keys, indexes (import first)
│   ├── seed.sql            ← test accounts + 48 sample reports (import second)
│   ├── migration_v2.sql    ← upgrades an older database without losing data
│   ├── migration_v3.sql    ← adds Help and Support (chat tables, Chat Schedule)
│   ├── migration_v4.sql    ← notifications for live chat replies + featured_case (landing page)
│   ├── migration_v5.sql    ← staff_notification (the bell for LGU and response teams)
│   └── migration_v6.sql    ← Data Privacy consent date + token_version (logout ends the session)
├── server/
│   ├── .env.example        ← copy to .env
│   ├── uploads/reports/    ← report photos (created automatically; back it up with the database)
│   ├── uploads/featured/   ← "after" photos of featured cases (same)
│   ├── config/
│   │   ├── areas.js        ← list of areas (puroks) — edit me
│   │   ├── rules.js        ← smart-rule numbers — edit me
│   │   ├── hotlines.js     ← emergency hotlines (verify every number) — edit me
│   │   ├── contact.js      ← barangay address, phone, email, Facebook, office hours — edit me
│   │   └── chatbotRules.js ← chatbot menu + keywords (EN/TL) — edit me
│   ├── services/
│   │   ├── smartRules.js   ← priority + similar-report rules
│   │   ├── smartRules.test.js ← Jest unit tests (npm test)
│   │   ├── chatSchedule.js ← is live chat open? (Asia/Manila)
│   │   ├── chatSchedule.test.js
│   │   ├── publicInfo.js   ← hotline + contact display rules (911 first, hide [REPLACE], ...)
│   │   └── publicInfo.test.js
│   ├── scripts/            ← hash-password, recalculate-priorities
│   └── src/
│       ├── server.js       ← starts the API
│       ├── app.js          ← routes and role checks
│       ├── config/db.js    ← MySQL connection pool
│       ├── middleware/     ← login (JWT) and role checks, error handling
│       ├── routes/         ← URL → controller
│       ├── controllers/    ← request handling and validation
│       ├── models/         ← SQL queries (parameterized)
│       └── utils/          ← validators, CSV, notification messages
└── client/
    └── src/
        ├── i18n/           ← en.json, tl.json (ALL on-screen text)
        ├── auth/           ← login state, route guards
        ├── components/     ← Header, Sidebar, BottomNav, Button, StatusBadge, charts…
        ├── layouts/        ← Resident, Staff, Auth page frames
        ├── pages/          ← resident/, team/, admin/, auth/, ProfilePage, PrivacyPage
        ├── config/privacy.js ← Data Protection Officer + retention period for /privacy — edit me
        └── utils/          ← formatting, validation, constants
```

---

## 10. Before real use

The system ships with sample and unconfirmed data. Before residents use it, do **all** of the following with Barangay Landayan, then restart the server (and rebuild the client for the last items):

- [ ] **Verify every hotline** in `server/config/hotlines.js`: call each number, fix it, and set `verified: true`. Replace every `"[REPLACE]"` number (City of San Pedro DRRMO, San Pedro City Police Station). The server prints a startup WARNING until all are verified.
- [ ] **Fill in `server/config/contact.js`**: confirm the address, phone, and office hours (then remove each `[CONFIRM]`), and put in the email (now `[REPLACE]`, so it is hidden).
- [ ] **Replace the purok list** in `server/config/areas.js` (now the placeholders *Purok 1* to *Purok 7*) and use the same names in each response team's assigned area.
- [ ] **Set the Data Protection Officer contact** (name, email, phone) and the **retention period** in `client/src/config/privacy.js` (now `[REPLACE]`; the Data Privacy Notice says "to be announced" until then).
- [ ] **Replace the official logo**: put the barangay's official transparent PNG in `client/public/images/` and regenerate the sizes (`landayan-logo-512/192/64.png`, `favicon.ico`). The current PNG was made from a JPG.
- [ ] **Confirm the Chat Schedule** (default Monday–Friday, 8:00 AM–5:00 PM) and set it, with holidays, on the LGU **Chat Schedule** page.
- [ ] **Confirm the `server/config/rules.js` values** (similar report 3 days, priority raise 3 reports in 7 days, overdue 7 days, hotspot 5 reports in 30 days, 5 photos of up to 5 MB).
- [ ] **Replace all seed accounts and the shared password**: do not import `seed.sql` on the real system (it creates `admin`, `team1`, `team2`, `juan`, `maria`, `pedro`, all with `Password123!`). Create the real LGU account (`npm run hash -- "a-strong-password"` for its hash), add the real response teams in **Manage Users**, and set a new long random `JWT_SECRET`.
