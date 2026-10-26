/**
 * The resident's live chat with a staff member (inside the Help panel).
 *   Waiting -> "Waiting for available staff… You are number N in line." (updates in real time)
 *   Active  -> "[Staff] will reply in about X minutes" with a countdown, then the
 *              messages (with times) and "typing…"
 *   Closed  -> "The chat has ended" + an optional 1-5 star rating
 */
import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useLanguage } from '../i18n/useLanguage';
import { formatTimeOfDay } from '../utils/format';
import '../pages/resident/Feedback.css';

// "4:05" from a number of seconds.
const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Live countdown until the promised reply time.
function ReplyCountdown({ session }) {
  const { t } = useLanguage();
  const deadline = session.acceptedAt + session.estimatedWaitMinutes * 60 * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.round((deadline - now) / 1000));
  return (
    <div className="live-banner live-banner--accepted">
      <Icon name="clock" size={20} />
      <div>
        <p className="live-banner__title">{t('liveChat.willReply', { staff: session.staffName, minutes: session.estimatedWaitMinutes })}</p>
        {/* Screen readers are not interrupted every second: only the text above is announced. */}
        <p className="live-banner__countdown" aria-hidden="true">
          {left > 0 ? t('liveChat.countdown', { time: mmss(left) }) : t('liveChat.anyMoment')}
        </p>
      </div>
    </div>
  );
}

// Optional 1-5 star rating after the chat (stored as a bot message).
function ChatRating({ busy, onFinish }) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  return (
    <div className="live-rating">
      <fieldset className="star-picker">
        <legend className="star-picker__question">{t('liveChat.rateQuestion')}</legend>
        <div className="star-picker__row">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={`star-picker__option ${value <= rating ? 'is-filled' : ''} ${value === rating ? 'is-selected' : ''}`}>
              <input type="radio" name="chat-rating" value={value} checked={rating === value} onChange={() => setRating(value)} className="visually-hidden" />
              <Icon name="star" size={32} filled={value <= rating} />
              <span className="star-picker__label">{t(`feedback.ratings.${value}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="live-rating__actions">
        <Button variant="outline" disabled={busy} onClick={() => onFinish(null)}>
          {t('liveChat.skip')}
        </Button>
        <Button disabled={busy || !rating} onClick={() => onFinish(rating)}>
          {t('liveChat.sendRating')}
        </Button>
      </div>
    </div>
  );
}

// Status lines saved by the server ("status:accepted" …) shown as small notes.
function systemText(message, session, t) {
  if (message === 'status:waiting') return t('liveChat.system.requested');
  if (message === 'status:accepted') return t('liveChat.system.joined', { staff: session.staffName });
  if (message.startsWith('status:ended')) return t('liveChat.system.ended');
  return null; // e.g. rating:4 is not shown
}

export default function LiveChatView({ live, busy, listRef, actions }) {
  const { t, language } = useLanguage();
  const { session, messages, typing } = live;
  const staffReplied = messages.some((m) => m.sender === 'staff');

  return (
    <div className="live-chat">
      {session.status === 'Waiting' && (
        <div className="live-banner" role="status">
          <Icon name="users" size={20} />
          <div>
            <p className="live-banner__title">{t('liveChat.waiting')}</p>
            {session.position && <p className="live-banner__countdown">{t('liveChat.position', { position: session.position })}</p>}
          </div>
        </div>
      )}
      {session.status === 'Active' && !staffReplied && session.acceptedAt && <ReplyCountdown session={session} />}

      <ol className="chatbot-panel__messages" ref={listRef} aria-live="polite">
        {messages.map((m) => {
          if (m.sender === 'bot') {
            const note = systemText(m.message, session, t);
            return note ? (
              <li key={m.id} className="live-note">
                {note}
              </li>
            ) : null;
          }
          const mine = m.sender === 'resident';
          return (
            <li key={m.id} className={`chat-bubble chat-bubble--${mine ? 'resident' : 'bot'}`}>
              <span className="chat-bubble__who">{mine ? t('chatbot.youSaid') : `${session.staffName}:`}</span>
              <p className="chat-bubble__text">{m.message}</p>
              <span className="chat-bubble__time">{formatTimeOfDay(m.dateSent, language)}</span>
            </li>
          );
        })}
        {typing && (
          <li className="chat-bubble chat-bubble--bot chat-bubble--typing">
            <span>{t('liveChat.staffTyping', { staff: session.staffName })}</span>
          </li>
        )}
      </ol>

      {session.status === 'Closed' ? (
        <div className="live-ended">
          <p className="live-ended__title">{t(session.endedBy === 'staff' ? 'liveChat.endedByStaff' : 'liveChat.ended')}</p>
          <ChatRating busy={busy} onFinish={actions.finishLive} />
        </div>
      ) : (
        <div className="live-chat__actions">
          <button type="button" className="live-chat__end" disabled={busy} onClick={actions.endLive}>
            <Icon name="close" size={18} />
            <span>{t(session.status === 'Waiting' ? 'liveChat.cancel' : 'liveChat.end')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
