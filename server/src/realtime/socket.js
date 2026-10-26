/**
 * Real-time connection (Socket.IO) for live chat.
 *
 * Every socket must log in: the client sends its login token when it connects,
 *   io(url, { auth: { token } })
 * and the same check as the REST API runs (valid JWT, account still exists
 * and is Active). Without a valid token the connection is refused, and the
 * client gets a "connect_error" whose message is the error code:
 *   UNAUTHORIZED, SESSION_EXPIRED, or ACCOUNT_INACTIVE.
 *
 * Rooms (the server sends to a room; everyone in it receives):
 *   "user:<role>:<id>"  one account, e.g. "user:resident:2" (all its browser tabs)
 *   "role:<role>"       everyone of a role, e.g. "role:lgu"
 *   "staff:available"   LGU / team accounts set to "Available" - only they get
 *                       queue updates (Away staff never receive chat requests)
 *
 * Chat actions (request, accept, send, end) go through the REST API, which
 * saves them and then calls the emit helpers below. Only the "typing…"
 * signal is sent directly through the socket ("live:typing").
 */
const { Server } = require('socket.io');
const { authenticateToken } = require('../middleware/auth');

let io = null;
const STAFF_ROLES = ['lgu', 'response_team'];
const userRoom = (role, id) => `user:${role}:${id}`;

function attachSocket(httpServer) {
  // Required here (not at the top) so the model is only loaded when the server starts.
  const LiveChat = require('../models/liveChat.model');

  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
  });

  // Runs once for every new connection, before "connection".
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const result = await authenticateToken(typeof token === 'string' ? token : '');
      if (result.error) return next(new Error(result.error.code));
      socket.data.user = result.user; // { id, role }
      return next();
    } catch (error) {
      console.error('Socket login check failed:', error.message);
      return next(new Error('SERVER_ERROR'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.data.user;
    socket.join(userRoom(role, id));
    socket.join(`role:${role}`);
    if (STAFF_ROLES.includes(role)) {
      try {
        if ((await LiveChat.getAvailability(role, id)) === 'Available') socket.join('staff:available');
      } catch (error) {
        console.error('Could not read chat availability:', error.message);
      }
    }

    // "typing…": passed on to the other person in the chat only.
    socket.on('live:typing', async (payload) => {
      try {
        const sessionId = Number(payload && payload.sessionId);
        if (!Number.isInteger(sessionId) || sessionId <= 0) return;
        const session = await LiveChat.findSession(sessionId);
        if (!session || session.status !== 'Active') return;
        const isResident = role === 'resident' && session.residentId === id;
        const isStaff = role === session.staffRole && session.staffId === id;
        if (isResident) emitToUser(session.staffRole, session.staffId, 'live:typing', { sessionId, from: 'resident' });
        if (isStaff) emitToUser('resident', session.residentId, 'live:typing', { sessionId, from: 'staff' });
      } catch (error) {
        console.error('Typing signal failed:', error.message);
      }
    });
  });

  return io;
}

/** Sends an event to every open tab of one account. */
function emitToUser(role, id, event, data) {
  if (io) io.to(userRoom(role, id)).emit(event, data);
}

/** Sends an event to staff who are "Available". */
function emitToAvailableStaff(event, data) {
  if (io) io.to('staff:available').emit(event, data);
}

/** Sends an event to every LGU and response team account (Available or Away). */
function emitToAllStaff(event, data) {
  if (io) io.to('role:lgu').to('role:response_team').emit(event, data);
}

/** Puts a staff member's open tabs in (or out of) the "staff:available" room. */
function setStaffAvailable(role, id, available) {
  if (!io) return;
  if (available) io.in(userRoom(role, id)).socketsJoin('staff:available');
  else io.in(userRoom(role, id)).socketsLeave('staff:available');
}

/** Closes every open connection of one account (after logout its token no longer works). */
function disconnectUser(role, id) {
  if (io) io.in(userRoom(role, id)).disconnectSockets(true);
}

/** The Socket.IO server (null until attachSocket runs). */
function getIo() {
  return io;
}

module.exports = { attachSocket, getIo, emitToUser, emitToAvailableStaff, emitToAllStaff, setStaffAvailable, disconnectUser };
