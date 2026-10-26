/**
 * One slide of the landing page "Resolved Cases" slideshow.
 * Also used as the live preview in the LGU "Feature on Landing Page" form,
 * so the preview looks exactly like the public slide.
 *   photoSrc:     URL of the "after" photo (or a temporary preview URL)
 *   caption:      LGU caption (English, as saved)
 *   issueType, area, dateResolved: from the report (no resident data)
 */
import Icon from './Icon';
import IssueTypeIcon from './IssueTypeIcon';
import { useLanguage } from '../i18n/useLanguage';
import { formatDate } from '../utils/format';
import './FeaturedSlide.css';

export default function FeaturedSlide({ photoSrc, caption, issueType, area, dateResolved }) {
  const { t, language } = useLanguage();

  return (
    <figure className="featured-slide">
      <div className="featured-slide__photo">
        {photoSrc ? (
          <img src={photoSrc} alt={t('featured.photoAlt', { type: issueType, area })} />
        ) : (
          <span className="featured-slide__no-photo">
            <Icon name="image" />
            {t('featured.noPhotoYet')}
          </span>
        )}
        <span className="featured-slide__resolved">
          <Icon name="checkCircle" />
          {t('status.resolved')}
        </span>
      </div>
      <figcaption className="featured-slide__body">
        <div className="featured-slide__meta">
          <IssueTypeIcon type={issueType} />
          <span className="featured-slide__place">
            <Icon name="mapPin" />
            {area}
          </span>
        </div>
        <p className="featured-slide__caption">{caption || t('featured.captionPlaceholder')}</p>
        {dateResolved && (
          <p className="featured-slide__date">{t('featured.resolvedOn', { date: formatDate(dateResolved, language) })}</p>
        )}
      </figcaption>
    </figure>
  );
}
