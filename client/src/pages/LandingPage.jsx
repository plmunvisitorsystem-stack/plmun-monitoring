/**
 * Public landing page ("/", for visitors who are not logged in).
 *   - hero on the barangay hall photo: logo, app name, Log In and Create Account
 *   - Contact and Office Hours, and the Emergency Hotlines box
 *   - footer with the Data Privacy Notice link
 *   - "Resolved Cases" slideshow: the cases the LGU featured
 *     (GET /api/public/resolved-cases, no login; never resident data)
 * The list is loaded again every 30 seconds and whenever the visitor comes back to the tab,
 * so a case the LGU features, hides, removes or moves shows up right away.
 * The slideshow moves by itself every few seconds, except when the mouse or
 * keyboard focus is on it, or when the visitor asked for reduced motion.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import LanguageSwitch from '../components/LanguageSwitch';
import FeaturedSlide from '../components/FeaturedSlide';
import HallPhoto from '../components/HallPhoto';
import HotlineList from '../components/HotlineList';
import { useApiData } from '../hooks/useApiData';
import { formatClock } from '../utils/format';
import { apiRequest } from '../api/client';
import { useLanguage } from '../i18n/useLanguage';
import './Landing.css';

const AUTO_ADVANCE_MS = 6000;
const REFRESH_MS = 30000; // also reload the list every 30 seconds while open

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function Slideshow({ cases }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = cases.length;

  // Keep the index valid when the list changes (a case was hidden or removed).
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  const go = (next) => setIndex((next + count) % count);
  const current = cases[Math.min(index, count - 1)];

  return (
    <div
      className="slideshow"
      role="region"
      aria-roledescription={t('landing.carousel')}
      aria-label={t('landing.casesTitle')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="slideshow__slide" role="group" aria-roledescription={t('landing.slide')} aria-label={t('landing.slideOf', { n: index + 1, total: count })}>
        <FeaturedSlide
          key={current.photoUrl}
          photoSrc={current.photoUrl}
          caption={current.caption}
          issueType={current.issueType}
          area={current.area}
          dateResolved={current.dateResolved}
        />
      </div>

      {count > 1 && (
        <div className="slideshow__controls">
          <button type="button" className="slideshow__arrow" onClick={() => go(index - 1)} aria-label={t('landing.previous')}>
            <Icon name="chevronLeft" />
          </button>
          <div className="slideshow__dots">
            {cases.map((item, i) => (
              <button
                key={item.photoUrl}
                type="button"
                className="slideshow__dot"
                aria-label={t('landing.goTo', { n: i + 1 })}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className="slideshow__arrow" onClick={() => go(index + 1)} aria-label={t('landing.next')}>
            <Icon name="chevronRight" />
          </button>
        </div>
      )}
      <p className="slideshow__position" aria-live="polite">
        {t('landing.slideOf', { n: index + 1, total: count })}
      </p>
    </div>
  );
}

/**
 * "Contact and Office Hours" + "Emergency Hotlines" (GET /api/public/contact and
 * /api/public/hotlines; the server already hid unknown values and developer notes).
 */
function ContactSection() {
  const { t, language } = useLanguage();
  const { data: contactData, errorCode: contactError } = useApiData('/public/contact');
  const { data: hotlineData, errorCode: hotlineError } = useApiData('/public/hotlines');
  const contact = contactData?.contact;
  const today = contactData?.chat?.today;

  return (
    <section className="landing__contact" aria-labelledby="landing-contact-title">
      <div className="contact-card">
        <h2 id="landing-contact-title" className="landing__section-title">
          {t('contact.title')}
        </h2>
        {contactError && <p className="text-muted">{t('contact.loadError')}</p>}
        {contact && (
          <dl className="contact-list">
            {contact.address && (
              <div>
                <dt>{t('contact.address')}</dt>
                <dd>{contact.address}</dd>
              </div>
            )}
            {contact.phone && (
              <div>
                <dt>{t('contact.phone')}</dt>
                <dd>
                  <a href={contact.phoneTel}>{contact.phone}</a>
                </dd>
              </div>
            )}
            {contact.email && (
              <div>
                <dt>{t('contact.email')}</dt>
                <dd>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </dd>
              </div>
            )}
            {contact.facebook && (
              <div>
                <dt>{t('contact.facebook')}</dt>
                <dd>
                  <a href={contact.facebook} target="_blank" rel="noopener noreferrer">
                    {t('contact.facebookLink')}
                  </a>
                </dd>
              </div>
            )}
            {contact.officeHours && (
              <div>
                <dt>{t('contact.officeHours')}</dt>
                <dd>{contact.officeHours}</dd>
              </div>
            )}
            {today && (
              <div>
                <dt>{t('contact.liveChatToday')}</dt>
                <dd>
                  {today.isOpen
                    ? t('contact.liveChatHours', { start: formatClock(today.start, language), end: formatClock(today.end, language) })
                    : t('contact.liveChatClosedToday')}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="hotline-box" role="region" aria-labelledby="landing-hotlines-title">
        <h2 id="landing-hotlines-title" className="hotline-box__title">
          <Icon name="phone" size={22} />
          <span>{t('hotlines.title')}</span>
        </h2>
        <p className="hotline-box__intro">{t('hotlines.intro')}</p>
        {hotlineError && <p>{t('hotlines.loadError')}</p>}
        {hotlineData && <HotlineList hotlines={hotlineData.hotlines} />}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();
  const [cases, setCases] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    apiRequest('/public/resolved-cases', { auth: false })
      .then((result) => {
        setCases(result.cases);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <Logo size={40} loading="eager" />
          <span className="landing__brand-name">{t('landing.brand')}</span>
        </div>
        <LanguageSwitch />
      </header>

      <main>
        <section className="landing__hero hall-bg">
          <HallPhoto priority />
          <Logo size={96} loading="eager" className="landing__hero-logo" />
          <h1 className="landing__title">{t('app.title')}</h1>
          <p className="landing__subtitle">{t('app.subtitle')}</p>
          <p className="landing__intro">{t('landing.intro')}</p>
          <div className="landing__actions">
            <Link to="/login" className="btn btn--primary">
              <span>{t('actions.logIn')}</span>
            </Link>
            <Link to="/register" className="btn btn--outline">
              <span>{t('actions.createAccount')}</span>
            </Link>
          </div>
        </section>

        <section className="landing__cases" aria-labelledby="landing-cases-title">
          <h2 id="landing-cases-title" className="landing__section-title">
            {t('landing.casesTitle')}
          </h2>
          <p className="text-muted landing__section-intro">{t('landing.casesIntro')}</p>
          {cases === null && !failed && <p className="text-muted" role="status">{t('common.loading')}</p>}
          {failed && cases === null && <p className="text-muted">{t('landing.loadError')}</p>}
          {cases && cases.length === 0 && <p className="landing__empty">{t('landing.noCases')}</p>}
          {cases && cases.length > 0 && <Slideshow cases={cases} />}
        </section>

        <ContactSection />
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-brand">
          <Logo size={48} />
          <div>
            <p className="landing__footer-title">{t('app.title')}</p>
            <p className="landing__footer-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>
        <Link to="/privacy" className="landing__footer-link">
          {t('privacy.footerLink')}
        </Link>
      </footer>
    </div>
  );
}
