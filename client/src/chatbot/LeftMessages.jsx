/**
 * Messages the resident left for staff outside the Chat Schedule (last 30
 * days), each with the staff reply or "No reply yet". Shown at the top of
 * the Help panel; a new reply also creates a notification.
 *   items: [{ sessionId, text, dateSent, replyText, replyDate, staffName }]
 */
import { useLanguage } from '../i18n/useLanguage';
import { formatDateTime } from '../utils/format';

export default function LeftMessages({ items }) {
  const { t, language } = useLanguage();
  return (
    <section className="chat-left" aria-label={t('liveChat.leftTitle')}>
      <h3 className="chat-left__title">{t('liveChat.leftTitle')}</h3>
      <ul className="chat-left__list">
        {items.map((item) => (
          <li key={item.sessionId} className="chat-left__item">
            <p className="chat-left__text">
              <span className="chat-bubble__who">{t('chatbot.youSaid')}</span> {item.text}
            </p>
            <p className="chat-bubble__time">{formatDateTime(item.dateSent, language)}</p>
            {item.replyText ? (
              <div className="chat-left__reply">
                <p className="chat-left__text">
                  <span className="chat-bubble__who">{item.staffName}:</span> {item.replyText}
                </p>
                <p className="chat-bubble__time">{formatDateTime(item.replyDate, language)}</p>
              </div>
            ) : (
              <p className="chat-bubble__note">{t('liveChat.noReplyYet')}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
