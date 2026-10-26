/**
 * Notification messages are saved in English in the database
 * (see server/src/utils/notificationMessages.js). Here we recognize them
 * and show them in the selected language.
 *
 * Three kinds of messages:
 *  1. Fixed texts, e.g. "Your report has been submitted."
 *  2. Status changes by a response team, e.g.
 *     "Your report #2026-0101 on Flooding is now In Progress."
 *  3. Assignment by the LGU, e.g.
 *     "Your report #2026-0101 has been assigned to Team Bravo and is now Under Review."
 */
import { formatReportId } from './format';
import { ISSUE_TYPE_KEYS, STATUS_KEYS } from './constants';

const FIXED_MESSAGES = {
  'Your report has been submitted.': 'submitted',
  'Your report is now under review.': 'underReview',
  'Your report is now in progress.': 'inProgress',
  'Your report has been resolved.': 'resolved',
  'A staff member replied to your message.': 'chatReply', // live chat (no report)
};

const STATUS_CHANGE_PATTERN =
  /^Your report #\d{4}-\d+ on (Waste Disposal|Pollution|Flooding|Other Hazard) is now (Submitted|Under Review|In Progress|Resolved)\.$/;

// The team name is any text (teams are named by the LGU).
const ASSIGNED_PATTERN = /^Your report #\d{4}-\d+ has been assigned to (.+) and is now Under Review\.$/;

// Icon for each notification type (names from components/Icon.jsx).
const TYPE_ICONS = {
  submitted: 'send',
  underReview: 'eye',
  inProgress: 'clock',
  resolved: 'checkCircle',
  chatReply: 'chat',
};

/** 'submitted' | 'underReview' | 'inProgress' | 'resolved' | null (unknown message) */
export function getNotificationType(notification) {
  if (FIXED_MESSAGES[notification.message]) return FIXED_MESSAGES[notification.message];
  if (ASSIGNED_PATTERN.test(notification.message)) return 'underReview';
  const match = notification.message.match(STATUS_CHANGE_PATTERN);
  return match ? STATUS_KEYS[match[2]] : null;
}

export function getNotificationIcon(type) {
  return TYPE_ICONS[type] || 'bell';
}

/**
 * The text to show, split around the report number so the page can keep
 * "#2026-0013" on one line:
 *   { before: 'Your report ', reportId: '#2026-0013', after: ' has been resolved.' }
 * Unknown messages are shown exactly as saved (before = message, no reportId).
 */
export function getNotificationParts(notification, t) {
  const reportId = formatReportId(notification.reportId, notification.reportDateSubmitted);
  let sentence;

  const fixedType = FIXED_MESSAGES[notification.message];
  const match = notification.message.match(STATUS_CHANGE_PATTERN);
  const assigned = notification.message.match(ASSIGNED_PATTERN);

  if (fixedType) {
    // Ask for the sentence with the placeholder left in, then split on it.
    sentence = t(`notifications.messages.${fixedType}`, { id: '{id}' });
  } else if (match) {
    sentence = t('notifications.statusChange', {
      id: '{id}',
      issueType: t(`issueType.${ISSUE_TYPE_KEYS[match[1]]}`),
      status: t(`status.${STATUS_KEYS[match[2]]}`),
    });
  } else if (assigned) {
    sentence = t('notifications.assigned', { id: '{id}', team: assigned[1] });
  } else {
    return { before: notification.message, reportId: '', after: '' };
  }

  // Split at the FIRST "{id}" only (a team name could contain the same text).
  const at = sentence.indexOf('{id}');
  if (at === -1) return { before: sentence, reportId: '', after: '' };
  return { before: sentence.slice(0, at), reportId, after: sentence.slice(at + '{id}'.length) };
}
