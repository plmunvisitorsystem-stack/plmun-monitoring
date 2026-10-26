/**
 * Help and Support - live chat.
 *
 * GET /api/chat/status (any logged-in account)
 *   { timeZone: 'Asia/Manila', now: { date, time, dayOfWeek },
 *     isOpenNow, today: { date, dayOfWeek, isOpen, start, end, source },
 *     nextOpening: { date, dayOfWeek, start, end } | null,
 *     availableStaff }
 * Live chat is open only during the Chat Schedule (services/chatSchedule.js);
 * availableStaff counts LGU and response team accounts set to "Available".
 */
const { pool } = require('../config/db');
const ChatSchedule = require('../../services/chatSchedule');

async function getStatus(req, res) {
  return res.json(await ChatSchedule.getChatStatus(pool));
}

module.exports = { getStatus };
