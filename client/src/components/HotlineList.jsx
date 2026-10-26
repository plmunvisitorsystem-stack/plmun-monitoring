/**
 * Emergency hotlines, used by the landing page "Emergency Hotlines" box and
 * the chatbot "Emergency" answer. The data comes from the server
 * (GET /api/public/hotlines or the chatbot answer), which already applied the
 * rules: 911 first, "[REPLACE]" entries hidden, no developer notes.
 *   hotlines: [{ id, name, number, tel, mobile: [{ number, tel }], address?, verified }]
 * Unconfirmed numbers get a small gray "To be confirmed" label. Every number,
 * including each mobile number, is its own tap-to-call link.
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import './HotlineList.css';

export default function HotlineList({ hotlines = [] }) {
  const { t } = useLanguage();

  return (
    <ul className="hotline-list">
      {hotlines.map((hotline) => (
        <li key={hotline.id} className="hotline-list__item">
          <p className="hotline-list__name">
            <span>{hotline.name}</span>
            {!hotline.verified && <span className="hotline-list__unconfirmed">{t('hotlines.toBeConfirmed')}</span>}
          </p>
          {hotline.address && <p className="hotline-list__address">{hotline.address}</p>}
          <div className="hotline-list__numbers">
            {[{ number: hotline.number, tel: hotline.tel }, ...(hotline.mobile || [])].map((entry) => (
              <a key={entry.tel} href={entry.tel} className="hotline-list__call" aria-label={t('hotlines.call', { name: hotline.name, number: entry.number })}>
                <Icon name="phone" size={18} />
                <span>{entry.number}</span>
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
