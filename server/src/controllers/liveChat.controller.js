/**
 * Live chat between residents and staff (LGU or response team accounts).
 * Every action is saved first, then pushed to the other person in real time
 * through Socket.IO (src/realtime/socket.js).
 *
 * Resident:  GET  /api/livechat/current              their open chat + messages they left
 *            POST /api/livechat/request              join the queue (only when open + staff Available)
 *            POST /api/livechat/leave                leave a message (any time)
 *            POST /api/livechat/sessions/:id/rating  rate the ended chat 1-5 (optional, once)
 * Staff:     GET/PATCH /api/livechat/availability   Available / Away
 *            GET  /api/livechat/queue                waiting residents + my active chats (Available only)
 *            POST /api/livechat/sessions/:id/accept  { estimatedWaitMinutes: 5 | 10 | 15 | 30 }
 *            GET  /api/livechat/messages-left        messages left and not answered yet
 *            POST /api/livechat/sessions/:id/reply   answer a message left (notifies the resident)
 * Both:      GET  /api/livechat/sessions/:id         one chat (only its resident or its staff member)
 *            POST /api/livechat/sessions/:id/messages  send a message
 *            POST /api/livechat/sessions/:id/end     end the chat
 *
 * Socket events sent by the server:
 *   to staff:    live:queue (reload the queue), live:left (reload messages left)
 *   to resident: live:position { sessionId, position }, live:accepted { session }, live:reply
 *   to both:     live:message { sessionId, message }, live:ended { sessionId, by }
 */
const { pool } = require('../config/db');
const LiveChat = require('../models/liveChat.model');
const ChatSchedule = require('../../services/chatSchedule');
const { CHAT_REPLY_MESSAGE } = require('../utils/notificationMessages');
const Realtime = require('../realtime/socket');

const WAIT_CHOICES = [5, 10, 15, 30];
const TEXT_MAX = 1000;
const STAFF_ROLES = ['lgu', 'response_team'];

const NOT_FOUND = { code: 'CHAT_SESSION_NOT_FOUND', message: 'Chat not found.' };
const isStaff = (user) => STAFF_ROLES.includes(user.role);

function readId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A message text: 1 to TEXT_MAX characters. Returns the text or null.
function readText(body) {
  const text = typeof (body || {}).text === 'string' ? body.text.trim() : '';
  return text && text.length <= TEXT_MAX ? text : null;
}
const textError = (res) =>
  res.status(400).json({ code: 'VALIDATION_FAILED', message: `Please type a message (up to ${TEXT_MAX} characters).`, fields: { text: 'FIELD_REQUIRED' } });

// Is this user the resident or the staff member of the session?
function isParticipant(user, session) {
  if (user.role === 'resident') return session.residentId === user.id;
  return session.staffRole === user.role && session.staffId === user.id;
}

// What the client needs about a session (no internal ids except the session id).
function sessionView(session) {
  return {
    id: session.id,
    status: session.status,
    residentName: session.residentName,
    staffName: session.staffName,
    estimatedWaitMinutes: session.estimatedWaitMinutes,
    acceptedSecondsAgo: session.acceptedSecondsAgo === null ? null : Number(session.acceptedSecondsAgo),
    rated: Number(session.ratings) > 0,
  };
}

/**
 * After the queue changes: staff who are Available reload their queue, and
 * every waiting resident gets their new place in line.
 */
async function broadcastQueue() {
  const queue = await LiveChat.findQueue();
  Realtime.emitToAvailableStaff('live:queue', { waiting: queue.length });
  queue.forEach((entry, index) => {
    Realtime.emitToUser('resident', entry.residentId, 'live:position', { sessionId: entry.id, position: index + 1 });
  });
  return queue;
}

async function positionOf(sessionId) {
  const queue = await LiveChat.findQueue();
  const index = queue.findIndex((entry) => entry.id === sessionId);
  return index === -1 ? null : index + 1;
}

// ----- Resident -----

async function getCurrent(req, res) {
  const session = await LiveChat.findOpenForResident(req.user.id);
  const leftMessages = await LiveChat.findLeftMessagesOfResident(req.user.id);
  if (!session) return res.json({ session: null, leftMessages });
  return res.json({
    session: { ...sessionView(session), position: session.status === 'Waiting' ? await positionOf(session.id) : null },
    messages: await LiveChat.findLiveMessages(session.id, session.waitingMessageId),
    leftMessages,
  });
}

async function requestStaff(req, res) {
  // Live chat only during the Chat Schedule AND with at least one Available staff member.
  const chat = await ChatSchedule.getChatStatus(pool);
  if (!chat.isOpenNow || chat.availableStaff === 0) {
    return res.status(409).json({ code: 'LIVE_CHAT_CLOSED', message: 'Live chat is closed. Please leave a message.', chat });
  }
  const session = await LiveChat.requestStaff(req.user.id, Number((req.body || {}).sessionId));
  await broadcastQueue();
  return res.json({
    session: { ...sessionView(session), position: session.status === 'Waiting' ? await positionOf(session.id) : null },
    messages: await LiveChat.findLiveMessages(session.id, session.waitingMessageId),
  });
}

async function leaveMessage(req, res) {
  const text = readText(req.body);
  if (!text) return textError(res);
  await LiveChat.leaveMessage(req.user.id, Number((req.body || {}).sessionId), text);
  Realtime.emitToAllStaff('live:left', {});
  return res.status(201).json({ leftMessages: await LiveChat.findLeftMessagesOfResident(req.user.id) });
}

async function rateChat(req, res) {
  const id = readId(req);
  const session = id && (await LiveChat.findSession(id));
  if (!session || session.residentId !== req.user.id) return res.status(404).json(NOT_FOUND);
  const rating = Number((req.body || {}).rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Choose 1 to 5 stars.', fields: { rating: 'INVALID_RATING' } });
  }
  if (session.status !== 'Closed') return res.status(409).json({ code: 'CHAT_NOT_ENDED', message: 'The chat has not ended yet.' });
  if (Number(session.ratings) > 0) return res.status(409).json({ code: 'CHAT_ALREADY_RATED', message: 'This chat was already rated.' });
  await LiveChat.addRating(id, rating);
  return res.status(201).json({ rating });
}

// ----- Staff -----

async function getAvailability(req, res) {
  return res.json({ availability: await LiveChat.getAvailability(req.user.role, req.user.id) });
}

async function setAvailability(req, res) {
  const { availability } = req.body || {};
  if (!['Available', 'Away'].includes(availability)) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Choose Available or Away.', fields: { availability: 'INVALID_AVAILABILITY' } });
  }
  await LiveChat.setAvailability(req.user.role, req.user.id, availability);
  Realtime.setStaffAvailable(req.user.role, req.user.id, availability === 'Available');
  return res.json({ availability });
}

const STAFF_AWAY = { code: 'STAFF_AWAY', message: 'Set yourself Available to receive chat requests.' };

async function getQueue(req, res) {
  if ((await LiveChat.getAvailability(req.user.role, req.user.id)) !== 'Available') return res.status(403).json(STAFF_AWAY);
  return res.json({ queue: await LiveChat.findQueue(), myChats: await LiveChat.findChatsOfStaff(req.user.role, req.user.id) });
}

async function acceptChat(req, res) {
  const id = readId(req);
  if (!id) return res.status(404).json(NOT_FOUND);
  if ((await LiveChat.getAvailability(req.user.role, req.user.id)) !== 'Available') return res.status(403).json(STAFF_AWAY);
  const minutes = Number((req.body || {}).estimatedWaitMinutes);
  if (!WAIT_CHOICES.includes(minutes)) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Choose 5, 10, 15, or 30 minutes.', fields: { estimatedWaitMinutes: 'INVALID_WAIT' } });
  }

  const outcome = await LiveChat.accept(id, req.user, minutes);
  if (outcome.result === 'not_found') return res.status(404).json(NOT_FOUND);
  if (outcome.result === 'already_taken') {
    return res.status(409).json({ code: 'CHAT_ALREADY_ACCEPTED', message: 'Another staff member already accepted this chat.' });
  }
  const session = sessionView(outcome.session);
  Realtime.emitToUser('resident', outcome.session.residentId, 'live:accepted', { session });
  // The "joined the chat" line, so the resident's history matches the database.
  Realtime.emitToUser('resident', outcome.session.residentId, 'live:message', { sessionId: id, message: outcome.message });
  await broadcastQueue();
  return res.json({ session });
}

async function getMessagesLeft(req, res) {
  const rows = await LiveChat.findUnansweredLeftMessages();
  return res.json({ messagesLeft: rows.map(({ sessionId, residentName, text, dateSent }) => ({ sessionId, residentName, text, dateSent })) });
}

async function replyToLeftMessage(req, res) {
  const id = readId(req);
  if (!id) return res.status(404).json(NOT_FOUND);
  const text = readText(req.body);
  if (!text) return textError(res);
  const outcome = await LiveChat.replyToLeftMessage(id, req.user, text, CHAT_REPLY_MESSAGE);
  if (outcome.result === 'not_found') return res.status(404).json(NOT_FOUND);
  if (outcome.result === 'already_replied') {
    return res.status(409).json({ code: 'MESSAGE_ALREADY_ANSWERED', message: 'Another staff member already answered this message.' });
  }
  Realtime.emitToUser('resident', outcome.residentId, 'live:reply', { sessionId: id });
  Realtime.emitToAllStaff('live:left', {});
  return res.status(201).json({ sessionId: id });
}

// ----- Both -----

async function getSession(req, res) {
  const id = readId(req);
  const session = id && (await LiveChat.findSession(id));
  if (!session || !isParticipant(req.user, session)) return res.status(404).json(NOT_FOUND);
  const body = {
    session: { ...sessionView(session), position: session.status === 'Waiting' ? await positionOf(session.id) : null },
    messages: await LiveChat.findLiveMessages(id, session.waitingMessageId),
  };
  // Staff see the resident's latest reports for context.
  if (isStaff(req.user)) body.residentReports = await LiveChat.findResidentReports(session.residentId);
  return res.json(body);
}

async function sendMessage(req, res) {
  const id = readId(req);
  const session = id && (await LiveChat.findSession(id));
  if (!session || !isParticipant(req.user, session)) return res.status(404).json(NOT_FOUND);
  const text = readText(req.body);
  if (!text) return textError(res);
  // Residents may write while waiting (staff see it in the queue); staff only after accepting.
  const allowed = req.user.role === 'resident' ? ['Waiting', 'Active'] : ['Active'];
  if (!allowed.includes(session.status)) return res.status(409).json({ code: 'CHAT_NOT_OPEN', message: 'This chat is not open.' });

  const message = await LiveChat.addMessage(id, req.user.role === 'resident' ? 'resident' : 'staff', text);
  Realtime.emitToUser('resident', session.residentId, 'live:message', { sessionId: id, message });
  if (session.staffRole) Realtime.emitToUser(session.staffRole, session.staffId, 'live:message', { sessionId: id, message });
  if (session.status === 'Waiting') Realtime.emitToAvailableStaff('live:queue', {}); // first message shows in the queue
  return res.status(201).json({ message });
}

async function endChat(req, res) {
  const id = readId(req);
  const session = id && (await LiveChat.findSession(id));
  if (!session || !isParticipant(req.user, session)) return res.status(404).json(NOT_FOUND);
  const by = req.user.role === 'resident' ? 'resident' : 'staff';
  if (!(await LiveChat.end(id, by))) return res.status(409).json({ code: 'CHAT_NOT_OPEN', message: 'This chat is not open.' });

  Realtime.emitToUser('resident', session.residentId, 'live:ended', { sessionId: id, by });
  if (session.staffRole) Realtime.emitToUser(session.staffRole, session.staffId, 'live:ended', { sessionId: id, by });
  if (session.status === 'Waiting') await broadcastQueue(); // the others move up
  return res.json({ sessionId: id, status: 'Closed' });
}

module.exports = {
  getCurrent,
  requestStaff,
  leaveMessage,
  rateChat,
  getAvailability,
  setAvailability,
  getQueue,
  acceptChat,
  getMessagesLeft,
  replyToLeftMessage,
  getSession,
  sendMessage,
  endChat,
};
