/**
 * One chatbot answer, shown in the selected language.
 *   intent: 'greeting' | 'unknown' | a menu option id (see server/config/chatbotRules.js)
 *   data:   extra data from the server (reports, chat schedule, hotlines)
 *   onLeaveMessage(text): used by the "Leave a Message" box (talkToStaff when closed)
 * All texts are in en.json / tl.json under "chatbot".
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import HotlineList from '../components/HotlineList';
import IssueTypeIcon from '../components/IssueTypeIcon';
import ReportStatus from '../components/ReportStatus';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/useLanguage';
import { ISSUE_TYPES, ISSUE_TYPE_KEYS } from '../utils/constants';
import { formatClock, formatDate, formatReportId, formatWeekdayDate } from '../utils/format';

const HOW_TO_STEPS = [1, 2, 3, 4, 5];

// Today's hours and the next opening (used by "Live chat schedule" and "Talk to staff").
function ScheduleInfo({ chat }) {
  const { t, language } = useLanguage();
  if (!chat) return null;
  const today = chat.today.isOpen
    ? t('chatbot.answers.schedule.today', { start: formatClock(chat.today.start, language), end: formatClock(chat.today.end, language) })
    : t('chatbot.answers.schedule.todayClosed');
  return (
    <>
      <p className={`chat-status ${chat.isOpenNow ? 'chat-status--open' : 'chat-status--closed'}`}>
        <Icon name={chat.isOpenNow ? 'checkCircle' : 'clock'} size={18} />
        <span>{t(chat.isOpenNow ? 'chatbot.answers.schedule.openNow' : 'chatbot.answers.schedule.closedNow')}</span>
      </p>
      <p className="chat-bubble__text">{today}</p>
      {chat.nextOpening && (
        <p className="chat-bubble__text">
          {t('chatbot.answers.schedule.next', {
            day: formatWeekdayDate(chat.nextOpening.date, language),
            time: formatClock(chat.nextOpening.start, language),
          })}
        </p>
      )}
      <p className="chat-bubble__note">{t('chatbot.answers.schedule.timeZone')}</p>
    </>
  );
}

// "Leave a Message" box (when live chat is closed or no staff is Available).
function LeaveMessageForm({ busy, onSend }) {
  const { t } = useLanguage();
  const inputId = useId(); // unique, the box can appear more than once
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  if (sent) return null;
  return (
    <form
      className="chat-leave"
      onSubmit={async (event) => {
        event.preventDefault();
        if (message.trim() && (await onSend(message.trim()))) setSent(true);
      }}
    >
      <label className="chat-leave__label" htmlFor={inputId}>
        {t('chatbot.answers.talkToStaff.leaveLabel')}
      </label>
      <textarea
        id={inputId}
        className="field__control chat-leave__input"
        rows={3}
        maxLength={1000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button type="submit" className="btn btn--primary chat-leave__send" disabled={busy || !message.trim()}>
        <Icon name="send" />
        <span>{t('chatbot.answers.talkToStaff.leaveButton')}</span>
      </button>
    </form>
  );
}

export default function BotAnswer({ intent, data = {}, busy = false, onLeaveMessage }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const text = (key, values) => <p className="chat-bubble__text">{t(key, values)}</p>;

  switch (intent) {
    case 'greeting':
      return text('chatbot.greeting', { name: user?.name || '' });

    case 'howToReport':
      return (
        <>
          {text('chatbot.answers.howToReport.intro')}
          <ol className="chat-steps">
            {HOW_TO_STEPS.map((step) => (
              <li key={step}>{t(`chatbot.answers.howToReport.step${step}`)}</li>
            ))}
          </ol>
          <Link to="/report" className="chat-link">
            {t('actions.reportConcern')}
          </Link>
        </>
      );

    case 'whatToReport':
      return (
        <>
          {text('chatbot.answers.whatToReport.intro')}
          <ul className="chat-issue-list">
            {ISSUE_TYPES.map((type) => (
              <li key={type}>
                <IssueTypeIcon type={type} />
                <span className="chat-bubble__note">{t(`chatbot.answers.whatToReport.${ISSUE_TYPE_KEYS[type]}`)}</span>
              </li>
            ))}
          </ul>
        </>
      );

    case 'myStatus': {
      const reports = data.reports || [];
      if (reports.length === 0) return text('chatbot.answers.myStatus.none');
      return (
        <>
          {text('chatbot.answers.myStatus.intro', { count: reports.length })}
          <ul className="chat-report-list">
            {reports.map((report) => (
              <li key={report.id}>
                <Link to={`/reports/${report.id}`} state={{ from: '/home' }} className="chat-report">
                  <span className="chat-report__id">{formatReportId(report.id, report.dateSubmitted)}</span>
                  <span className="chat-report__meta">
                    {t(`issueType.${ISSUE_TYPE_KEYS[report.issueType]}`)} · {formatDate(report.dateSubmitted, language)}
                  </span>
                  <ReportStatus status={report.status} isOverdue={report.isOverdue} />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/reports" className="chat-link">
            {t('chatbot.answers.myStatus.viewAll')}
          </Link>
        </>
      );
    }

    case 'schedule':
      return (
        <>
          {text('chatbot.answers.schedule.intro')}
          <ScheduleInfo chat={data.chat} />
        </>
      );

    case 'emergency':
      return (
        <>
          <p className="chat-emergency">
            <Icon name="warning" size={20} />
            <span>{t('chatbot.answers.emergency.warning')}</span>
          </p>
          {/* Same data and rules as the landing page (GET /api/public/hotlines) */}
          <HotlineList hotlines={data.hotlines} />
        </>
      );

    case 'talkToStaff': {
      const chat = data.chat;
      if (chat?.isOpenNow && chat.availableStaff > 0) return text('chatbot.answers.talkToStaff.connecting');
      // Outside the Chat Schedule, or nobody is Available: only "Leave a Message".
      return (
        <>
          <p className="chat-bubble__text chat-closed">
            {chat?.nextOpening && !chat.isOpenNow
              ? t('chatbot.answers.talkToStaff.closed', {
                  day: formatWeekdayDate(chat.nextOpening.date, language),
                  time: formatClock(chat.nextOpening.start, language),
                })
              : t('chatbot.answers.talkToStaff.noStaff')}
          </p>
          <LeaveMessageForm busy={busy} onSend={onLeaveMessage} />
        </>
      );
    }

    case 'messageLeft':
      return text('chatbot.answers.messageLeft');

    case 'liveThanks':
      return text('chatbot.answers.liveThanks');

    case 'liveEnded':
      return text('chatbot.answers.liveEnded');

    default: // 'unknown'
      return text('chatbot.answers.unknown');
  }
}
