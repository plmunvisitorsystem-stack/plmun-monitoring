/**
 * Public landing page ("/", for visitors who are not logged in).
 *   - hero on the barangay hall photo: logo, app name, Submit a Report, Create Account
 *   - how reporting works, and what can be reported
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
import { ISSUE_TYPES, ISSUE_TYPE_ICONS, ISSUE_TYPE_KEYS } from '../utils/constants';
import SkipLink from '../components/SkipLink';
import { apiRequest } from '../api/client';
import { useLanguage } from '../i18n/useLanguage';
import './Landing.css';

const HOW_STEPS = [1, 2, 3, 4]; // texts: landing.howStep1Title, landing.howStep1, ...
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
    <section id="contact" className="landing__contact" aria-labelledby="landing-contact-title">
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

      <div id="hotlines" className="hotline-box" role="region" aria-labelledby="landing-hotlines-title">
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
      <SkipLink />
      <header className="landing__header">
        <div className="landing__brand">
          <Logo size={40} loading="eager" />
          <span className="landing__brand-name">{t('landing.brand')}</span>
        </div>
        <nav className="landing__nav" aria-label={t('nav.mainMenu')}>
          <a href="#how">{t('landing.navHow')}</a>
          <a href="#report">{t('landing.navReport')}</a>
          <a href="#contact">{t('landing.navContact')}</a>
        </nav>
        <div className="landing__header-actions">
          <LanguageSwitch />
          <Link to="/login" className="landing__login">
            {t('actions.logIn')}
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="landing__hero hall-bg">
          <HallPhoto priority />
          <div className="landing__hero-inner">
            <div className="landing__identity">
              <Logo size={72} loading="eager" className="landing__hero-logo" />
              <div>
                <p className="landing__system">{t('app.title')}</p>
                <p className="landing__subtitle">{t('app.subtitle')}</p>
              </div>
            </div>
            <h1 className="landing__title">{t('landing.heroTitle')}</h1>
            <p className="landing__intro">{t('landing.intro')}</p>
            <div className="landing__actions">
              <Link to="/login" className="btn btn--outline">
                <span>{t('landing.submitReport')}</span>
              </Link>
              <Link to="/register" className="btn landing__action-secondary">
                <span>{t('actions.createAccount')}</span>
              </Link>
            </div>
            <p className="landing__emergency">
              {t('landing.heroEmergency')} <a href="#hotlines">{t('landing.heroEmergencyLink')}</a>
            </p>
          </div>
        </section>

        <section id="how" className="landing__section landing__section--white" aria-labelledby="landing-how-title">
          <div className="landing__container">
            <h2 id="landing-how-title" className="landing__section-title">
              {t('landing.howTitle')}
            </h2>
            <ol className="how-steps">
              {HOW_STEPS.map((step, index) => (
                <li key={step} className="how-steps__item">
                  <span className="how-steps__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className="how-steps__title">{t(`landing.howStep${step}Title`)}</h3>
                  <p className="how-steps__text">{t(`landing.howStep${step}`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="report" className="landing__section" aria-labelledby="landing-report-title">
          <div className="landing__container">
            <h2 id="landing-report-title" className="landing__section-title">
              {t('landing.reportTitle')}
            </h2>
            <ul className="concern-list">
              {ISSUE_TYPES.map((type) => {
                const key = ISSUE_TYPE_KEYS[type];
                return (
                  <li key={type} className="concern-list__item">
                    <span className="concern-list__icon">
                      <Icon name={ISSUE_TYPE_ICONS[type]} />
                    </span>
                    <div>
                      <h3 className="concern-list__title">{t(`issueType.${key}`)}</h3>
                      <p className="concern-list__text">{t(`chatbot.answers.whatToReport.${key}`)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Shown only when the barangay has featured a case (or while loading it fails silently below) */}
        {(failed || (cases && cases.length > 0)) && (
          <section className="landing__section landing__section--white" aria-labelledby="landing-cases-title">
            <div className="landing__container">
              <h2 id="landing-cases-title" className="landing__section-title">
                {t('landing.casesTitle')}
              </h2>
              <p className="text-muted landing__section-intro">{t('landing.casesIntro')}</p>
              {failed && cases === null && <p className="text-muted">{t('landing.loadError')}</p>}
              {cases && cases.length > 0 && <Slideshow cases={cases} />}
            </div>
          </section>
        )}

        <ContactSection />
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-brand">
            <Logo size={48} />
            <div>
              <p className="landing__footer-title">{t('landing.brand')}</p>
              <p className="landing__footer-subtitle">{t('app.subtitle')}</p>
            </div>
          </div>
          <nav className="landing__footer-links" aria-label={t('landing.navContact')}>
            <a href="#contact">{t('landing.navContact')}</a>
            <a href="#hotlines">{t('hotlines.title')}</a>
            <Link to="/login">{t('actions.logIn')}</Link>
            <Link to="/privacy">{t('privacy.footerLink')}</Link>
          </nav>
        </div>
        <p className="landing__footer-note">
          {t('app.title')}. {t('landing.footerNote')}
        </p>
      </footer>
    </div>
  );
}
