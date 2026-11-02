/**
 * Floating "Help" button (above the bottom navigation) and the chat panel.
 * Bot mode: menu buttons under the latest bot answer; typed questions are
 * matched by keywords on the server. Live mode (waiting for / chatting with
 * staff): see LiveChatView.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import Alert from '../components/Alert';
import BotAnswer from './BotAnswer';
import LiveChatView from './LiveChatView';
import LeftMessages from './LeftMessages';
import { useLanguage } from '../i18n/useLanguage';
import '../components/Input.css';
import '../components/Button.css';
import './Chatbot.css';

const TEXT_MAX = 500;
const LIVE_TEXT_MAX = 1000;

export default function ChatbotWidget({ open, onOpen, onClose, menu, messages, live, leftMessages, busy, errorCode, actions }) {
  const { t } = useLanguage();
  const location = useLocation();
  const titleId = useId();
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const returnFocusRef = useRef(false);

  const liveOpen = live && ['Waiting', 'Active'].includes(live.session.status);

  // Close the panel when the resident follows a link to another page.
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  // Focus the text box when the panel opens; scroll to the newest message.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, live, open]);

  // After the resident closes the panel, put the keyboard focus back on the
  // Help button (it only appears again after the panel is gone).
  useEffect(() => {
    if (!open && returnFocusRef.current) {
      returnFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  function close() {
    returnFocusRef.current = true;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    const sent = liveOpen ? await actions.sendLive(value) : await actions.send({ text: value });
    if (sent) setText('');
  }

  if (!open) {
    return (
      <button ref={buttonRef} type="button" className="chatbot-button" onClick={onOpen} aria-haspopup="dialog">
        <Icon name="chat" />
        <span>{t('chatbot.button')}</span>
      </button>
    );
  }

  const lastBot = [...messages].reverse().find((m) => m.from === 'bot');
  const showInput = !live || liveOpen; // after a live chat ends, the rating replaces the text box

  return (
    <section
      className="chatbot-panel"
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <header className="chatbot-panel__header">
        <span className="chatbot-panel__avatar">
          <Icon name="chat" size={20} />
        </span>
        <h2 id={titleId} className="chatbot-panel__title">
          {t(live ? 'liveChat.title' : 'chatbot.title')}
        </h2>
        <button type="button" className="chatbot-panel__close" onClick={close} aria-label={t('chatbot.close')}>
          <Icon name="close" />
        </button>
      </header>

      {live ? (
        <LiveChatView live={live} busy={busy} listRef={listRef} actions={actions} />
      ) : (
        /* New answers are read out by screen readers (aria-live). */
        <ol className="chatbot-panel__messages" ref={listRef} aria-live="polite">
          {leftMessages.length > 0 && (
            <li className="chat-left-wrap">
              <LeftMessages items={leftMessages} />
            </li>
          )}
          {messages.map((message) => (
            <li key={message.key} className={`chat-bubble chat-bubble--${message.from}`}>
              <span className="visually-hidden">{t(message.from === 'bot' ? 'chatbot.botSaid' : 'chatbot.youSaid')}</span>
              {message.from === 'bot' ? (
                <BotAnswer intent={message.intent} data={message.data} busy={busy} onLeaveMessage={actions.leaveMessage} />
              ) : (
                <p className="chat-bubble__text">{message.option ? t(`chatbot.options.${message.option}`) : message.text}</p>
              )}
              {message === lastBot && menu.length > 0 && (
                <div className="chatbot-menu" role="group" aria-label={t('chatbot.menuLabel')}>
                  {menu.map((option) => (
                    <button key={option} type="button" className="chatbot-menu__option" disabled={busy} onClick={() => actions.send({ option })}>
                      {t(`chatbot.options.${option}`)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
          {busy && (
            <li className="chat-bubble chat-bubble--bot chat-bubble--typing">
              <span>{t('chatbot.typing')}</span>
            </li>
          )}
        </ol>
      )}

      {errorCode && (
        <div className="chatbot-panel__error">
          <Alert type="error">{t(`errors.${errorCode}`)}</Alert>
        </div>
      )}

      {showInput && (
        <form className="chatbot-panel__form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor={`${titleId}-input`}>
            {t(liveOpen ? 'liveChat.inputLabel' : 'chatbot.inputLabel')}
          </label>
          <input
            id={`${titleId}-input`}
            ref={inputRef}
            className="field__control chatbot-panel__input"
            value={text}
            maxLength={liveOpen ? LIVE_TEXT_MAX : TEXT_MAX}
            placeholder={t(liveOpen ? 'liveChat.placeholder' : 'chatbot.placeholder')}
            autoComplete="off"
            onChange={(event) => {
              setText(event.target.value);
              if (liveOpen) actions.typing();
            }}
          />
          <button type="submit" className="btn btn--primary chatbot-panel__send" disabled={busy || !text.trim()} aria-label={t('chatbot.send')}>
            <Icon name="send" />
          </button>
        </form>
      )}
    </section>
  );
}
