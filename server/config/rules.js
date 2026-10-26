/**
 * Smart feature rules (rule-based, no AI).
 * Change a number here and restart the server; every feature that uses it
 * follows automatically.
 */
module.exports = {
  // A new report is marked "similar" to an UNRESOLVED report with the same
  // issue type in the same area submitted within this many days.
  SIMILAR_DAYS: 3,

  // Priority (see services/smartRules.js). Each issue type has a base priority
  // (Flooding High; Pollution, Other Hazard Medium; Waste Disposal Low).
  // When PRIORITY_RAISE_COUNT or more reports (including the new one) with the
  // same issue type in the same area arrive within PRIORITY_RAISE_DAYS, the
  // priority goes up one level for the new report and the unresolved others.
  // After changing these numbers, run "npm run recalc-priorities" to update old reports.
  PRIORITY_RAISE_COUNT: 3,
  PRIORITY_RAISE_DAYS: 7,

  // A report that is not Resolved this many days after it was submitted is overdue.
  OVERDUE_DAYS: 7,

  // An area is a hotspot when it has at least HOTSPOT_COUNT reports in the last HOTSPOT_DAYS days.
  HOTSPOT_COUNT: 5,
  HOTSPOT_DAYS: 30,

  // Photo upload limits per report.
  MAX_PHOTOS: 5,
  MAX_PHOTO_MB: 5,
};
