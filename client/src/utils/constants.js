/**
 * Values that match the database ENUMs.
 * The database always stores the English value; the *_KEYS maps give the
 * i18n key used to show the translated word on screen.
 */

// Statuses in their only allowed order: Submitted -> Under Review -> In Progress -> Resolved.
export const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];

export const STATUS_KEYS = {
  Submitted: 'submitted',
  'Under Review': 'underReview',
  'In Progress': 'inProgress',
  Resolved: 'resolved',
};

export const ISSUE_TYPES = ['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];

export const ISSUE_TYPE_KEYS = {
  'Waste Disposal': 'wasteDisposal',
  Pollution: 'pollution',
  Flooding: 'flooding',
  'Other Hazard': 'otherHazard',
};

// Report priority (set by the rules in server/config/rules.js).
export const PRIORITY_KEYS = { High: 'high', Medium: 'medium', Low: 'low' };

// Icon for each issue type (names from components/Icon.jsx):
// trash, smoke cloud, water waves, warning triangle.
export const ISSUE_TYPE_ICONS = {
  'Waste Disposal': 'trash',
  Pollution: 'smoke',
  Flooding: 'waves',
  'Other Hazard': 'warning',
};
