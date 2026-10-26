/**
 * The real-time connection (Socket.IO) used by live chat.
 *
 *   const socket = getSocket();                 // connects once, with the login token
 *   useSocketEvent('live:message', (data) => …) // listen while a component is on screen
 *
 * It connects to the same address as the page (/socket.io), which Vite
 * forwards to the API server. The server refuses connections without a valid
 * token. disconnectSocket() is called on logout, so a shared phone never keeps
 * receiving the previous user's chat.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../auth/session';

let socket = null;
let socketToken = null;

export function getSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  if (socket) socket.disconnect(); // another account logged in
  socketToken = token;
  socket = io({ auth: { token } });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketToken = null;
}

/** Runs handler(data) every time the server sends this event, while the component is shown. */
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler; // always call the newest handler

  useEffect(() => {
    const current = getSocket();
    if (!current) return undefined;
    const listener = (data) => handlerRef.current(data);
    current.on(event, listener);
    return () => current.off(event, listener);
  }, [event]);
}

/** Tells the other person "typing…" - at most once every 2 seconds. */
let lastTyping = 0;
export function sendTyping(sessionId) {
  if (Date.now() - lastTyping < 2000) return;
  lastTyping = Date.now();
  getSocket()?.emit('live:typing', { sessionId });
}
