/**
 * Notification messages. They are stored in English (database values stay
 * in English); the client recognizes these exact patterns and shows them
 * in English or Tagalog. If you change a message here, also update
 * client/src/utils/notifications.js.
 */

// Saved when a resident submits a report (Task 5), and in older seed data.
const STATUS_MESSAGES = {
  Submitted: 'Your report has been submitted.',
  'Under Review': 'Your report is now under review.',
  'In Progress': 'Your report is now in progress.',
  Resolved: 'Your report has been resolved.',
};

/**
 * Saved after a response team changes the status, e.g.
 *   "Your report #2026-0101 on Flooding is now In Progress."
 */
function statusChangeMessage(displayId, issueType, status) {
  return `Your report ${displayId} on ${issueType} is now ${status}.`;
}

/**
 * Saved when the LGU assigns a Submitted report to a team, e.g.
 *   "Your report #2026-0101 has been assigned to Team Bravo and is now Under Review."
 */
function assignedMessage(displayId, teamName) {
  return `Your report ${displayId} has been assigned to ${teamName} and is now Under Review.`;
}

/** Saved when a staff member answers a message the resident left in Help (live chat). */
const CHAT_REPLY_MESSAGE = 'A staff member replied to your message.';

module.exports = { STATUS_MESSAGES, statusChangeMessage, assignedMessage, CHAT_REPLY_MESSAGE };
