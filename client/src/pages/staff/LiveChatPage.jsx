/**
 * Live Chat for staff (/admin/live-chat and /team/live-chat).
 *   - Available / Away switch (chat_availability). Only Available staff see the
 *     queue and receive new chat requests.
 *   - Queue: waiting residents, oldest first (name, waiting time, first message),
 *     updated in real time. "Accept" asks for the estimated reply time.
 *   - Messages Left: messages residents left outside the Chat Schedule; the
 *     reply reaches the resident's chat and creates a notification.
 *   - Chat window: resident name, their latest reports, messages, quick replies, End Chat.
 *   role: 'lgu' or 'response_team'
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { getSocket, sendTyping, useSocketEvent } from '../../realtime/socket';
import { ISSUE_TYPE_KEYS } from '../../utils/constants';
import { formatDateTime, formatReportId, formatTimeOfDay } from '../../utils/format';
import '../../chatbot/Chatbot.css'; // chat bubbles shared with the resident panel
import './LiveChat.css';

const WAIT_CHOICES = [5, 10, 15, 30];
const QUICK_REPLIES = [1, 2, 3, 4];

export default function LiveChatPage({ role }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [availability, setAvailability] = useState(null);
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [myChats, setMyChats] = useState([]);
  const [messagesLeft, setMessagesLeft] = useState([]);
  const [unread, setUnread] = useState([]); // ids of my chats with new messages
  const [chat, setChat] = useState(null); // { session, messages, residentReports }
  const [typing, setTyping] = useState(false);
  const [acceptFor, setAcceptFor] = useState(null); // queue entry in the dialog
  const [wait, setWait] = useState(5);
  const [text, setText] = useState('');
  const [replies, setReplies] = useState({}); // sessionId -> reply text
  const [errorCode, setErrorCode] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0); // re-render every 30 s so waiting times stay current
  const busyRef = useRef(false);
  const typingTimer = useRef(null);
  const listRef = useRef(null);

  const available = availability === 'Available';
  const reportPath = role === 'lgu' ? '/admin/reports' : '/team/reports';

  const loadQueue = useCallback(async () => {
    try {
      const result = await apiRequest('/livechat/queue');
      setQueue(result.queue);
      setMyChats(result.myChats);
    } catch (error) {
      if (error.code === 'STAFF_AWAY') setQueue([]);
      else setErrorCode(error.code);
    }
  }, []);
  const loadLeft = useCallback(async () => {
    try {
      setMessagesLeft((await apiRequest('/livechat/messages-left')).messagesLeft);
    } catch (error) {
      setErrorCode(error.code);
    }
  }, []);
  const openChat = useCallback(async (id) => {
    const result = await apiRequest(`/livechat/sessions/${id}`);
    setChat(result);
    setTyping(false);
    setUnread((list) => list.filter((x) => x !== id));
  }, []);

  useEffect(() => {
    getSocket();
    apiRequest('/livechat/availability').then((r) => setAvailability(r.availability)).catch((e) => setErrorCode(e.code));
    loadLeft();
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, [loadLeft]);
  useEffect(() => {
    if (available) loadQueue();
  }, [available, loadQueue]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat, typing]);

  // Runs one action at a time and shows its error.
  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorCode(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setErrorCode(error.code);
      if (error.code === 'CHAT_ALREADY_ACCEPTED') loadQueue();
      if (error.code === 'MESSAGE_ALREADY_ANSWERED') loadLeft();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const toggleAvailability = () => run(async () => {
    const next = available ? 'Away' : 'Available';
    await apiRequest('/livechat/availability', { method: 'PATCH', body: { availability: next } });
    setAvailability(next);
    getSocket()?.connect(); // make sure the socket is connected to receive the queue
  });

  const accept = () => run(async () => {
    const id = acceptFor.id;
    setAcceptFor(null);
    await apiRequest(`/livechat/sessions/${id}/accept`, { method: 'POST', body: { estimatedWaitMinutes: wait } });
    await loadQueue();
    await openChat(id);
  });

  const send = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    run(async () => {
      const result = await apiRequest(`/livechat/sessions/${chat.session.id}/messages`, { method: 'POST', body: { text: value } });
      setChat((current) => (current.messages.some((m) => m.id === result.message.id) ? current : { ...current, messages: [...current.messages, result.message] }));
      setText('');
    });
  };

  const endChat = () => run(async () => {
    await apiRequest(`/livechat/sessions/${chat.session.id}/end`, { method: 'POST' });
    setChat((current) => ({ ...current, session: { ...current.session, status: 'Closed' } }));
    loadQueue();
  });

  const sendReply = (sessionId) => run(async () => {
    await apiRequest(`/livechat/sessions/${sessionId}/reply`, { method: 'POST', body: { text: replies[sessionId].trim() } });
    setReplies((r) => ({ ...r, [sessionId]: '' }));
    setNotice(t('liveChat.staff.replySent'));
    loadLeft();
  });

  // ----- Real-time updates -----
  useSocketEvent('live:queue', () => available && loadQueue());
  useSocketEvent('live:left', () => loadLeft());
  useSocketEvent('live:message', ({ sessionId, message }) => {
    if (chat && chat.session.id === sessionId) {
      setChat((current) => (current.messages.some((m) => m.id === message.id) ? current : { ...current, messages: [...current.messages, message] }));
      if (message.sender === 'resident') setTyping(false);
    } else {
      setUnread((list) => (list.includes(sessionId) ? list : [...list, sessionId]));
    }
  });
  useSocketEvent('live:typing', ({ sessionId, from }) => {
    if (from !== 'resident' || !chat || chat.session.id !== sessionId) return;
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  });
  useSocketEvent('live:ended', ({ sessionId }) => {
    if (chat && chat.session.id === sessionId) setChat((current) => ({ ...current, session: { ...current.session, status: 'Closed' } }));
    loadQueue();
  });

  const minutesWaiting = (entry) => Math.max(0, Math.floor(entry.waitingSeconds / 60));
  const canOpenReport = (report) => role === 'lgu' || report.teamId === user.id;

  return (
    <StaffLayout role={role}>
      <div className="live-staff__heading">
        <div>
          <h1 className="page-title">{t('nav.liveChat')}</h1>
          <p className="text-muted">{t('liveChat.staff.intro')}</p>
        </div>
        {availability && (
          <button
            type="button"
            role="switch"
            aria-checked={available}
            className={`availability-switch ${available ? 'is-available' : ''}`}
            onClick={toggleAvailability}
            disabled={busy}
          >
            <span className="availability-switch__track" aria-hidden="true">
              <span className="availability-switch__thumb" />
            </span>
            <span>{t(available ? 'liveChat.staff.available' : 'liveChat.staff.away')}</span>
          </button>
        )}
      </div>

      {errorCode && <Alert type="error">{t(`errors.${errorCode}`)}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <div className="live-staff">
        {/* ----- Left: queue, messages left, my chats ----- */}
        <div className="live-staff__lists">
          <div className="live-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'queue'} className="live-tabs__tab" onClick={() => setTab('queue')}>
              {t('liveChat.staff.queueTab', { count: available ? queue.length : 0 })}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'left'} className="live-tabs__tab" onClick={() => setTab('left')}>
              {t('liveChat.staff.leftTab', { count: messagesLeft.length })}
            </button>
          </div>

          {tab === 'queue' && (
            <Card className="live-panel" title={t('liveChat.staff.queueTitle')}>
              {!available ? (
                <p className="live-away">{t('liveChat.staff.awayHint')}</p>
              ) : queue.length === 0 ? (
                <p className="text-muted">{t('liveChat.staff.queueEmpty')}</p>
              ) : (
                <ol className="live-queue">
                  {queue.map((entry, index) => (
                    <li key={entry.id} className="live-queue__item">
                      <span className="live-queue__place">{index + 1}</span>
                      <div className="live-queue__info">
                        <p className="live-queue__name">{entry.residentName}</p>
                        <p className="text-muted">{t('liveChat.staff.waitingFor', { minutes: minutesWaiting(entry) })}</p>
                        <p className="live-queue__message">{entry.firstMessage || t('liveChat.staff.noMessageYet')}</p>
                      </div>
                      <Button icon="check" disabled={busy} onClick={() => { setWait(5); setAcceptFor(entry); }} aria-label={t('liveChat.staff.acceptFor', { name: entry.residentName })}>
                        {t('liveChat.staff.accept')}
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {tab === 'left' && (
            <Card className="live-panel" title={t('liveChat.staff.leftTitle')}>
              {messagesLeft.length === 0 ? (
                <p className="text-muted">{t('liveChat.staff.leftEmpty')}</p>
              ) : (
                <ul className="live-left">
                  {messagesLeft.map((item) => (
                    <li key={item.sessionId} className="live-left__item">
                      <p className="live-queue__name">{item.residentName}</p>
                      <p className="text-muted">{formatDateTime(item.dateSent, language)}</p>
                      <p className="live-left__text">{item.text}</p>
                      <label className="visually-hidden" htmlFor={`reply-${item.sessionId}`}>
                        {t('liveChat.staff.replyTo', { name: item.residentName })}
                      </label>
                      <textarea
                        id={`reply-${item.sessionId}`}
                        className="field__control"
                        rows={3}
                        maxLength={1000}
                        placeholder={t('liveChat.staff.replyPlaceholder')}
                        value={replies[item.sessionId] || ''}
                        onChange={(event) => setReplies((r) => ({ ...r, [item.sessionId]: event.target.value }))}
                      />
                      <Button icon="send" disabled={busy || !(replies[item.sessionId] || '').trim()} onClick={() => sendReply(item.sessionId)}>
                        {t('liveChat.staff.sendReply')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {myChats.length > 0 && (
            <Card className="live-panel" title={t('liveChat.staff.myChats')}>
              <ul className="live-mychats">
                {myChats.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`live-mychats__item ${chat?.session.id === item.id ? 'is-open' : ''}`} onClick={() => run(() => openChat(item.id))}>
                      <Icon name="chat" size={20} />
                      <span>{item.residentName}</span>
                      {unread.includes(item.id) && <span className="live-mychats__new">{t('liveChat.staff.newMessage')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* ----- Right: the chat window ----- */}
        <Card className="live-window">
          {!chat ? (
            <EmptyState icon="chat" title={t('liveChat.staff.noChatTitle')} message={t('liveChat.staff.noChatMessage')} />
          ) : (
            <>
              <div className="live-window__head">
                <h2 className="section-title">{chat.session.residentName}</h2>
                {chat.session.status === 'Active' && (
                  <Button variant="outline" icon="close" disabled={busy} onClick={endChat}>
                    {t('liveChat.end')}
                  </Button>
                )}
              </div>

              <details className="live-reports" open>
                <summary>{t('liveChat.staff.latestReports')}</summary>
                {chat.residentReports.length === 0 ? (
                  <p className="text-muted">{t('chatbot.answers.myStatus.none')}</p>
                ) : (
                  <ul className="live-reports__list">
                    {chat.residentReports.map((report) => {
                      const id = formatReportId(report.id, report.dateSubmitted);
                      return (
                        <li key={report.id}>
                          {canOpenReport(report) ? <Link to={`${reportPath}/${report.id}`}>{id}</Link> : <span className="live-reports__id">{id}</span>}
                          <span className="text-muted">{t(`issueType.${ISSUE_TYPE_KEYS[report.issueType]}`)} · {report.area}</span>
                          <StatusBadge status={report.status} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </details>

              <ol className="live-window__messages" ref={listRef} aria-live="polite">
                {chat.messages.filter((m) => m.sender !== 'bot').map((m) => (
                  <li key={m.id} className={`chat-bubble ${m.sender === 'staff' ? 'chat-bubble--resident' : 'chat-bubble--bot'}`}>
                    <span className="chat-bubble__who">{m.sender === 'staff' ? t('chatbot.youSaid') : `${chat.session.residentName}:`}</span>
                    <p className="chat-bubble__text">{m.message}</p>
                    <span className="chat-bubble__time">{formatTimeOfDay(m.dateSent, language)}</span>
                  </li>
                ))}
                {typing && (
                  <li className="chat-bubble chat-bubble--bot chat-bubble--typing">{t('liveChat.staff.residentTyping', { name: chat.session.residentName })}</li>
                )}
                {chat.session.status === 'Closed' && <li className="live-note">{t('liveChat.system.ended')}</li>}
              </ol>

              {chat.session.status === 'Active' && (
                <>
                  <div className="live-quick" role="group" aria-label={t('liveChat.staff.quickReplies')}>
                    {QUICK_REPLIES.map((n) => (
                      <button key={n} type="button" className="chatbot-menu__option" onClick={() => setText(t(`liveChat.staff.quick${n}`))}>
                        {t(`liveChat.staff.quick${n}`)}
                      </button>
                    ))}
                  </div>
                  <form className="live-window__form" onSubmit={send}>
                    <label className="visually-hidden" htmlFor="staff-chat-input">
                      {t('liveChat.inputLabel')}
                    </label>
                    <input
                      id="staff-chat-input"
                      className="field__control"
                      value={text}
                      maxLength={1000}
                      autoComplete="off"
                      placeholder={t('liveChat.placeholder')}
                      onChange={(event) => {
                        setText(event.target.value);
                        sendTyping(chat.session.id);
                      }}
                    />
                    <Button type="submit" icon="send" disabled={busy || !text.trim()}>
                      {t('chatbot.send')}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {/* ----- Accept: choose the estimated reply time ----- */}
      <Modal open={Boolean(acceptFor)} title={t('liveChat.staff.acceptTitle', { name: acceptFor?.residentName || '' })} onClose={() => setAcceptFor(null)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            accept();
          }}
        >
          <fieldset className="wait-choices">
            <legend className="field__label">{t('liveChat.staff.waitQuestion')}</legend>
            {WAIT_CHOICES.map((minutes) => (
              <label key={minutes} className={`wait-choices__option ${wait === minutes ? 'is-selected' : ''}`}>
                <input type="radio" name="wait" value={minutes} checked={wait === minutes} onChange={() => setWait(minutes)} />
                <span>{t('liveChat.staff.minutes', { minutes })}</span>
              </label>
            ))}
          </fieldset>
          <div className="modal__actions">
            <Button variant="outline" onClick={() => setAcceptFor(null)}>
              {t('assignDialog.cancel')}
            </Button>
            <Button type="submit" icon="check" disabled={busy}>
              {t('liveChat.staff.confirmAccept')}
            </Button>
          </div>
        </form>
      </Modal>
    </StaffLayout>
  );
}
