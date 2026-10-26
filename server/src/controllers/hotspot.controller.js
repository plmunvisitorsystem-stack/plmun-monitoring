/**
 * GET /api/hotspots - areas with HOTSPOT_COUNT or more reports in the last
 * HOTSPOT_DAYS days (see services/smartRules.js), highest total first.
 * LGU: every area. Response team: only the areas in its assigned_area.
 * Returns { days, minReports, hotspots: [{ area, total, byIssueType, topIssueType }] }.
 */
const { pool } = require('../config/db');
const Account = require('../models/account.model');
const SmartRules = require('../../services/smartRules');
const RULES = require('../../config/rules');

async function getHotspots(req, res) {
  let areas = null; // null = all areas (LGU)
  if (req.user.role === 'response_team') {
    // assigned_area is a list like "Purok 1, Purok 2, Purok 3".
    const team = await Account.getProfile('response_team', req.user.id);
    areas = team.assignedArea.split(',').map((area) => area.trim()).filter(Boolean);
  }
  return res.json({ days: RULES.HOTSPOT_DAYS, minReports: RULES.HOTSPOT_COUNT, hotspots: await SmartRules.findHotspots(pool, areas) });
}

module.exports = { getHotspots };
