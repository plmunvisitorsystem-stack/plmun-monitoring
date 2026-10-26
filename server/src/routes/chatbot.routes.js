/**
 * Chatbot routes (mounted at /api/chatbot in app.js; residents only):
 *   POST /api/chatbot/start    - continue or start a chatbot conversation
 *   POST /api/chatbot/message  - send a menu choice or a typed message, get the answer
 */
const express = require('express');
const { start, sendMessage } = require('../controllers/chatbot.controller');

const router = express.Router();

router.post('/start', start);
router.post('/message', sendMessage);

module.exports = router;
