/**
 * Chat Schedule page (LGU only): when live chat is open, in Asia/Manila time.
 * requireAuth + requireRole('lgu') run first, so req.user.id is the lgu_id.
 * Every answer returns the whole schedule so the page can redraw it.
 *   { weekly: [7 days], special: [upcoming special dates], status: GET /api/chat/status data }
 */
const { pool } = require('../config/db');
const ScheduleModel = require('../models/chatSchedule.model');
const ChatSchedule = require('../../services/chatSchedule');
const { validateWeeklySchedule, validateSpecialDate } = require('../utils/validators');

const VALIDATION_FAILED = { code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.' };

async function fullSchedule() {
  const status = await ChatSchedule.getChatStatus(pool);
  const [weekly, special] = await Promise.all([ScheduleModel.findWeekly(), ScheduleModel.findSpecialFrom(status.now.date)]);
  return { weekly, special, status };
}

/** GET /api/admin/chat-schedule */
async function getSchedule(req, res) {
  return res.json(await fullSchedule());
}

/** PUT /api/admin/chat-schedule/weekly  { days: [{ dayOfWeek, isOpen, start, end }] x 7 } */
async function saveWeekly(req, res) {
  const { days, errors } = validateWeeklySchedule(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ ...VALIDATION_FAILED, fields: errors });

  await ScheduleModel.saveWeekly(req.user.id, days);
  return res.json(await fullSchedule());
}

/** POST /api/admin/chat-schedule/special  { date, isOpen, start, end } (same date again = replace) */
async function saveSpecial(req, res) {
  const { values, errors } = validateSpecialDate(req.body || {}, ChatSchedule.manilaNow().date);
  if (Object.keys(errors).length > 0) return res.status(400).json({ ...VALIDATION_FAILED, fields: errors });

  await ScheduleModel.saveSpecial(req.user.id, values);
  return res.json(await fullSchedule());
}

/** DELETE /api/admin/chat-schedule/special/:id */
async function removeSpecial(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || !(await ScheduleModel.removeSpecial(id))) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Special date not found.' });
  }
  return res.json(await fullSchedule());
}

module.exports = { getSchedule, saveWeekly, saveSpecial, removeSpecial };
