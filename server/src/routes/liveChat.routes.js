/**
 * Live chat routes (mounted at /api/livechat in app.js, which requires a valid
 * login token). Each route lists which roles may use it; see
 * controllers/liveChat.controller.js for what each one does.
 */
const express = require('express');
const LiveChat = require('../controllers/liveChat.controller');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const resident = requireRole('resident');
const staff = requireRole('lgu', 'response_team');
const anyone = requireRole('resident', 'lgu', 'response_team');

// Resident
router.get('/current', resident, LiveChat.getCurrent);
router.post('/request', resident, LiveChat.requestStaff);
router.post('/leave', resident, LiveChat.leaveMessage);
router.post('/sessions/:id/rating', resident, LiveChat.rateChat);

// Staff (LGU and response teams)
router.get('/availability', staff, LiveChat.getAvailability);
router.patch('/availability', staff, LiveChat.setAvailability);
router.get('/queue', staff, LiveChat.getQueue);
router.get('/messages-left', staff, LiveChat.getMessagesLeft);
router.post('/sessions/:id/accept', staff, LiveChat.acceptChat);
router.post('/sessions/:id/reply', staff, LiveChat.replyToLeftMessage);

// The resident or the staff member of the chat
router.get('/sessions/:id', anyone, LiveChat.getSession);
router.post('/sessions/:id/messages', anyone, LiveChat.sendMessage);
router.post('/sessions/:id/end', anyone, LiveChat.endChat);

module.exports = router;
