/**
 * Help chatbot + live chat for residents. Used in App.jsx as a parent route
 * around all resident pages, so the floating "Help" button is on every
 * resident page and the conversation stays while the resident moves between
 * pages. (Everything is also saved in the database by the server.)
 *
 * Bot messages in memory:
 *   { key, from: 'bot', intent, data }        - a bot answer (shown in the chosen language)
 *   { key, from: 'resident', option | text }  - a menu button the resident clicked, or typed text
 *
 * Live chat (live): { session, messages, typing } while the resident waits for,
 * or chats with, a staff member. Updates arrive through Socket.IO:
 *   live:position, live:accepted, live:message, live:typing, live:ended, live:reply
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { getSocket, sendTyping, useSocketEvent } from '../realtime/socket';
import { useUnreadCount } from '../notifications/useUnreadCount';
import ChatbotWidget from './ChatbotWidget';

let nextKey = 1;

// The client keeps its own clock for the reply countdown (no time zone problems).
const withAcceptedAt = (session) => ({
  ...session,
  acceptedAt: session.acceptedSecondsAgo === null ? null : Date.now() - session.acceptedSecondsAgo * 1000,
});

export default function ChatbotProvider() {
  const location = useLocation();
  const { refreshUnreadCount } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState([]);
  const [messages, setMessages] = useState([]);
  const [live, setLive] = useState(null); // { session, messages, typing }
  const [leftMessages, setLeftMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const sessionRef = useRef(null); // the chatbot chat_session id
  const busyRef = useRef(false); // blocks double clicks before React re-renders
  const typingTimer = useRef(null);

  const add = (message) => setMessages((list) => [...list, { key: nextKey++, ...message }]);

  // Connect the real-time channel while the resident uses the app.
  useEffect(() => {
    getSocket();
  }, []);

  /** Starts (or continues) the chatbot conversation; the server saves the greeting. */
  const startSession = useCallback(async ({ showGreeting }) => {
    const result = await apiRequest('/chatbot/start', { method: 'POST', body: { sessionId: sessionRef.current } });
    if (result.sessionId !== sessionRef.current) {
      sessionRef.current = result.sessionId;
      if (showGreeting) setMessages([{ key: nextKey++, from: 'bot', intent: 'greeting', data: {} }]);
    }
    setMenu(result.menu);
  }, []);

  /** The resident's open live chat (if any) and the messages they left for staff. */
  const loadCurrent = useCallback(async () => {
    const result = await apiRequest('/livechat/current');
    setLeftMessages(result.leftMessages);
    setLive(result.session ? { session: withAcceptedAt(result.session), messages: result.messages, typing: false } : null);
  }, []);

  const openPanel = useCallback(async () => {
    setOpen(true);
    setErrorCode(null);
    try {
      await Promise.all([sessionRef.current ? null : startSession({ showGreeting: true }), loadCurrent()]);
    } catch (error) {
      setErrorCode(error.code);
    }
  }, [startSession, loadCurrent]);

  // A notification about a staff reply opens Help directly (state from NotificationsPage).
  useEffect(() => {
    if (location.state?.openHelp) openPanel();
  }, [location.state, openPanel]);

  // Runs an action once at a time, showing errors in the panel. Returns its result (or false).
  const run = useCallback(async (action) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setErrorCode(null);
    try {
      return (await action()) ?? true;
    } catch (error) {
      setErrorCode(error.code);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /** Joins the live chat queue (the server checks the schedule and staff again). */
  const requestStaff = useCallback(async () => {
    try {
      const result = await apiRequest('/livechat/request', { method: 'POST', body: { sessionId: sessionRef.current } });
      setLive({ session: withAcceptedAt(result.session), messages: result.messages, typing: false });
    } catch (error) {
      if (error.code !== 'LIVE_CHAT_CLOSED') throw error;
      add({ from: 'bot', intent: 'talkToStaff', data: { chat: error.data?.chat } }); // closed: offer "Leave a Message"
    }
  }, []);

  /** Sends a menu choice ({ option }) or typed text ({ text }) to the chatbot. */
  const send = useCallback((input) => run(async () => {
    if (!sessionRef.current) await startSession({ showGreeting: false });
    let result;
    try {
      result = await apiRequest('/chatbot/message', { method: 'POST', body: { sessionId: sessionRef.current, ...input } });
    } catch (error) {
      // The chatbot session ended (e.g. it became a live chat): continue in a new one.
      if (error.code !== 'CHAT_SESSION_NOT_FOUND') throw error;
      sessionRef.current = null;
      await startSession({ showGreeting: false });
      result = await apiRequest('/chatbot/message', { method: 'POST', body: { sessionId: sessionRef.current, ...input } });
    }
    add({ from: 'resident', ...input });
    add({ from: 'bot', intent: result.reply.intent, data: result.reply.data });
    // "Talk to staff" while live chat is open: join the queue right away.
    const chat = result.reply.data.chat;
    if (result.reply.intent === 'talkToStaff' && chat?.isOpenNow && chat.availableStaff > 0) await requestStaff();
    return true;
  }), [run, startSession, requestStaff]);

  /** Leaves a message for staff (outside the schedule or with no staff available). */
  const leaveMessage = useCallback((text) => run(async () => {
    const result = await apiRequest('/livechat/leave', { method: 'POST', body: { sessionId: sessionRef.current, text } });
    sessionRef.current = null; // that chatbot session is now a "Message Left"
    setLeftMessages(result.leftMessages);
    add({ from: 'resident', text });
    add({ from: 'bot', intent: 'messageLeft', data: {} });
    return true;
  }), [run]);

  const appendLiveMessage = (sessionId, message) =>
    setLive((current) => {
      if (!current || current.session.id !== sessionId || current.messages.some((m) => m.id === message.id)) return current;
      return { ...current, messages: [...current.messages, message], typing: message.sender === 'staff' ? false : current.typing };
    });

  const sendLive = useCallback((text) => run(async () => {
    const id = live.session.id;
    const result = await apiRequest(`/livechat/sessions/${id}/messages`, { method: 'POST', body: { text } });
    appendLiveMessage(id, result.message);
    return true;
  }), [run, live]);

  const endLive = useCallback(() => run(async () => {
    await apiRequest(`/livechat/sessions/${live.session.id}/end`, { method: 'POST' });
    setLive((current) => current && { ...current, session: { ...current.session, status: 'Closed', endedBy: 'resident' } });
    return true;
  }), [run, live]);

  /** After the chat: rate it (1-5) or skip, then back to the chatbot menu. */
  const finishLive = useCallback((rating) => run(async () => {
    if (rating) await apiRequest(`/livechat/sessions/${live.session.id}/rating`, { method: 'POST', body: { rating } });
    setLive(null);
    sessionRef.current = null; // the next question starts a new chatbot session
    if (menu.length === 0) await startSession({ showGreeting: false });
    add({ from: 'bot', intent: rating ? 'liveThanks' : 'liveEnded', data: {} });
    return true;
  }), [run, live, menu.length, startSession]);

  const typing = useCallback(() => {
    if (live?.session.status === 'Active') sendTyping(live.session.id);
  }, [live]);

  // ----- Real-time updates -----
  useSocketEvent('live:position', ({ sessionId, position }) =>
    setLive((current) => (current && current.session.id === sessionId ? { ...current, session: { ...current.session, position } } : current)));
  useSocketEvent('live:accepted', ({ session }) =>
    setLive((current) => (current && current.session.id === session.id ? { ...current, session: withAcceptedAt({ ...session, position: null }) } : current)));
  useSocketEvent('live:message', ({ sessionId, message }) => appendLiveMessage(sessionId, message));
  useSocketEvent('live:typing', ({ sessionId, from }) => {
    if (from !== 'staff') return;
    setLive((current) => (current && current.session.id === sessionId ? { ...current, typing: true } : current));
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setLive((current) => current && { ...current, typing: false }), 3000);
  });
  useSocketEvent('live:ended', ({ sessionId, by }) =>
    setLive((current) => (current && current.session.id === sessionId
      ? { ...current, typing: false, session: { ...current.session, status: 'Closed', endedBy: by } }
      : current)));
  useSocketEvent('live:reply', () => {
    refreshUnreadCount();
    apiRequest('/livechat/current').then((result) => setLeftMessages(result.leftMessages)).catch(() => {});
  });

  return (
    <>
      <Outlet />
      <ChatbotWidget
        open={open}
        onOpen={openPanel}
        onClose={() => setOpen(false)}
        menu={menu}
        messages={messages}
        live={live}
        leftMessages={leftMessages}
        busy={busy}
        errorCode={errorCode}
        actions={{ send, leaveMessage, sendLive, endLive, finishLive, typing }}
      />
    </>
  );
}
