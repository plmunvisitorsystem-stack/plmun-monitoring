/**
 * Rule-based chatbot for residents (requireAuth + requireRole('resident') run first).
 *
 * POST /api/chatbot/start    { sessionId? }
 *   Continues the resident's own chatbot session, or starts a new one with a
 *   greeting. -> { sessionId, menu, resumed }
 *
 * POST /api/chatbot/message  { sessionId, option }  or  { sessionId, text }
 *   option: a menu button id; text: a typed message (matched by keywords).
 *   Saves both messages and answers with
 *   -> { sessionId, reply: { intent, data } }
 *   intent: one of the menu ids, or 'unknown' (the client then shows the menu again).
 *   data:   myStatus    -> { reports }  the resident's 5 latest reports (only their own)
 *           schedule    -> chat status (today's hours, next opening)
 *           talkToStaff -> chat status
 *           emergency   -> { hotlines }
 */
const RULES = require('../../config/chatbotRules');
const HOTLINES = require('../../config/hotlines');
const { pool } = require('../config/db');
const Chat = require('../models/chat.model');
const Report = require('../models/report.model');
const { matchIntent } = require('../../services/chatbot');
const ChatSchedule = require('../../services/chatSchedule');
const { publicHotlines } = require('../../services/publicInfo');

const TEXT_MAX = 500;
const SESSION_NOT_FOUND = { code: 'CHAT_SESSION_NOT_FOUND', message: 'This chat has ended. Please start again.' };

// The resident's own chatbot session, or null.
async function ownBotSession(sessionId, residentId) {
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const session = await Chat.findSession(id);
  return session && session.residentId === residentId && session.status === 'Bot' ? session : null;
}

async function start(req, res) {
  const existing = await ownBotSession((req.body || {}).sessionId, req.user.id);
  const sessionId = existing ? existing.id : await Chat.createBotSession(req.user.id);
  return res.json({ sessionId, menu: RULES.MENU, resumed: Boolean(existing) });
}

// The extra data each answer needs (read fresh from the database).
async function replyData(intent, residentId) {
  if (intent === 'myStatus') {
    const reports = (await Report.findByResident(residentId)).slice(0, 5); // newest first, own reports only
    return { reports: reports.map(({ id, issueType, status, dateSubmitted, isOverdue }) => ({ id, issueType, status, dateSubmitted, isOverdue })) };
  }
  if (intent === 'schedule' || intent === 'talkToStaff') return { chat: await ChatSchedule.getChatStatus(pool) };
  // Same data and rules as GET /api/public/hotlines (landing page).
  if (intent === 'emergency') return { hotlines: publicHotlines(HOTLINES) };
  return {};
}

async function sendMessage(req, res) {
  const body = req.body || {};
  const session = await ownBotSession(body.sessionId, req.user.id);
  if (!session) return res.status(404).json(SESSION_NOT_FOUND);

  let residentMessage;
  let intent;
  if (body.option !== undefined) {
    if (!RULES.MENU.includes(body.option)) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Unknown menu option.', fields: { option: 'INVALID_OPTION' } });
    }
    residentMessage = `option:${body.option}`;
    intent = body.option;
  } else {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please type a message.', fields: { text: 'FIELD_REQUIRED' } });
    if (text.length > TEXT_MAX) return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Message is too long.', fields: { text: 'TOO_LONG' } });
    residentMessage = text;
    intent = matchIntent(text) || 'unknown';
  }

  await Chat.saveExchange(session.id, residentMessage, `intent:${intent}`);
  return res.json({ sessionId: session.id, reply: { intent, data: await replyData(intent, req.user.id) } });
}

module.exports = { start, sendMessage };
