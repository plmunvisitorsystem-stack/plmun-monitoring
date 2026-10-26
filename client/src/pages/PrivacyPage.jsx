/**
 * Public "Data Privacy Notice" (/privacy) in plain English and Tagalog,
 * as required by the Data Privacy Act of 2012 (RA 10173).
 * Open to everyone (logged in or not); linked from the landing page footer
 * and the Register page. The officer and retention details come from
 * src/config/privacy.js; until they are filled in, the page says so and
 * shows the barangay office contact instead.
 */
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import LanguageSwitch from '../components/LanguageSwitch';
import { useLanguage } from '../i18n/useLanguage';
import { useApiData } from '../hooks/useApiData';
import { DATA_PROTECTION_OFFICER, RETENTION_PERIOD, isPlaceholder } from '../config/privacy';
import './Landing.css';
import './Privacy.css';

// Number of items in each list in en.json / tl.json ("privacy.collected" ...).
const LISTS = { collected: 6, why: 5, who: 5, rights: 3 };

function PrivacyList({ name }) {
  const { t } = useLanguage();
  return (
    <ul>
      {Array.from({ length: LISTS[name] }, (_, i) => (
        <li key={i}>{t(`privacy.${name}.${i}`)}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  const { t } = useLanguage();
  const { data } = useApiData('/public/contact');
  const contact = data?.contact || {};
  const dpo = DATA_PROTECTION_OFFICER;
  const dpoKnown = !isPlaceholder(dpo.name);

  return (
    <div className="landing privacy">
      <header className="landing__header">
        <Link to="/" className="landing__brand privacy__brand">
          <Logo size={40} loading="eager" />
          <span className="landing__brand-name">{t('landing.brand')}</span>
        </Link>
        <LanguageSwitch />
      </header>

      <main className="privacy__main">
        <Link to="/" className="privacy__back">
          <Icon name="arrowLeft" size={20} />
          <span>{t('privacy.back')}</span>
        </Link>
        <article className="privacy__card">
          <h1 className="page-title">{t('privacy.title')}</h1>
          <p>{t('privacy.intro')}</p>

          <h2>{t('privacy.collectedTitle')}</h2>
          <PrivacyList name="collected" />

          <h2>{t('privacy.whyTitle')}</h2>
          <PrivacyList name="why" />

          <h2>{t('privacy.whoTitle')}</h2>
          <PrivacyList name="who" />

          <h2>{t('privacy.keepTitle')}</h2>
          <p>{t('privacy.keep')}</p>
          <p>{t('privacy.keepPeriod', { period: isPlaceholder(RETENTION_PERIOD) ? t('privacy.toBeConfirmed') : RETENTION_PERIOD })}</p>

          <h2>{t('privacy.rightsTitle')}</h2>
          <PrivacyList name="rights" />

          <h2>{t('privacy.contactTitle')}</h2>
          {dpoKnown ? (
            <ul className="privacy__contact">
              <li>{t('privacy.dpo', { name: dpo.name })}</li>
              {!isPlaceholder(dpo.email) && <li>{t('privacy.dpoEmail', { email: dpo.email })}</li>}
              {!isPlaceholder(dpo.phone) && <li>{t('privacy.dpoPhone', { phone: dpo.phone })}</li>}
            </ul>
          ) : (
            <>
              <p>{t('privacy.dpoPending')}</p>
              <ul className="privacy__contact">
                {contact.address && <li>{t('contact.address')}: {contact.address}</li>}
                {contact.phone && (
                  <li>
                    {t('contact.phone')}: <a href={contact.phoneTel}>{contact.phone}</a>
                  </li>
                )}
                {contact.email && <li>{t('contact.email')}: {contact.email}</li>}
                {contact.officeHours && <li>{t('contact.officeHours')}: {contact.officeHours}</li>}
              </ul>
            </>
          )}
        </article>
      </main>
    </div>
  );
}
