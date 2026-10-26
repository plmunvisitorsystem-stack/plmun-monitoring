/**
 * Read-only star rating, e.g. ★★★★☆ for rating 4.
 * Screen readers hear "4 out of 5 stars" instead of five icons.
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import './RatingStars.css';

export default function RatingStars({ rating, size = 24 }) {
  const { t } = useLanguage();

  return (
    <span className="rating-stars" role="img" aria-label={t('feedback.outOfFive', { rating })}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Icon
          key={value}
          name="star"
          size={size}
          filled={value <= rating}
          className={value <= rating ? 'rating-stars__star is-filled' : 'rating-stars__star'}
        />
      ))}
    </span>
  );
}
