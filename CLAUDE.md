# Coding Rules

- Read only files relevant to the task.
- Reuse existing components and project conventions.
- Make minimal, targeted changes.
- Do not rewrite working code.
- Avoid unnecessary dependencies and abstractions.
- Run only relevant tests.
- Keep explanations concise.
- Report changed files and test results.
- Ask before expanding the requested scope.

# Project Rules: Help and Support (Task 23)

- The chatbot is rule-based only (menu options and keywords, no AI), in English and Tagalog.
- Live chat staff = any LGU or response team account that sets itself "Available". Real-time messaging uses Socket.IO with JWT authentication on the socket connection.
- Live chat is open only during the Chat Schedule set by the LGU administrator. Default: Monday to Friday, 8:00 AM–5:00 PM, Asia/Manila time. The admin can change days, times, and closed dates (e.g., holidays).
- Emergencies are not handled in chat; the bot shows the emergency hotlines from /server/config/hotlines.js (placeholders to be replaced).
