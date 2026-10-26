/**
 * Public contact details and emergency hotlines (no login), for the landing
 * page "Contact and Office Hours" section and "Emergency Hotlines" box.
 * The rules (911 first, [REPLACE] hidden, [CONFIRM] removed, no developer
 * fields) are in services/publicInfo.js.
 *
 * GET /api/public/contact
 *   { contact: { address?, phone?, phoneTel?, email?, facebook?, officeHours? },
 *     chat: { isOpenNow, today: { isOpen, start, end } } }
 *   "chat" is today's live chat hours, from the same Chat Schedule data as
 *   GET /api/chat/status (which needs a login, so it cannot be used here).
 * GET /api/public/hotlines
 *   { hotlines: [{ id, name, number, tel, mobile: [{ number, tel }], address?, verified }] }
 */
const { pool } = require('../config/db');
const CONTACT = require('../../config/contact');
const HOTLINES = require('../../config/hotlines');
const ChatSchedule = require('../../services/chatSchedule');
const { publicContact, publicHotlines } = require('../../services/publicInfo');

async function getContact(req, res) {
  const status = await ChatSchedule.getChatStatus(pool);
  const { isOpen, start, end } = status.today;
  return res.json({ contact: publicContact(CONTACT), chat: { isOpenNow: status.isOpenNow, today: { isOpen, start, end } } });
}

function getHotlines(req, res) {
  return res.json({ hotlines: publicHotlines(HOTLINES) });
}

module.exports = { getContact, getHotlines };
