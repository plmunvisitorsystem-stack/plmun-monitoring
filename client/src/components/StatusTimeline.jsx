/**
 * Vertical status timeline:  Submitted -> Under Review -> In Progress -> Resolved
 *   status: the report's current status (English database value)
 *
 * - Finished steps: green circle with a check mark
 * - Current step:   highlighted in its status color, with a "Current status" tag
 *                   (Resolved is both current and finished, so it is green-checked)
 * - Future steps:   gray
 * Only the current status is stored (no status history), so steps have no dates.
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import { STATUSES, STATUS_KEYS } from '../utils/constants';
import './StatusTimeline.css';

export default function StatusTimeline({ status }) {
  const { t } = useLanguage();
  const currentIndex = STATUSES.indexOf(status);
  const isResolved = status === 'Resolved';

  return (
    <ol className="timeline">
      {STATUSES.map((step, index) => {
        const key = STATUS_KEYS[step];
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex || (isCurrent && isResolved);
        // CSS class decides the colors: done (green), current (status color), upcoming (gray)
        const state = isCurrent ? 'current' : isDone ? 'done' : 'upcoming';

        return (
          <li
            key={step}
            className={`timeline__step timeline__step--${state} ${isDone ? 'is-done' : ''} timeline__step--${key}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="timeline__marker">
              {isDone ? <Icon name="check" size={18} /> : <span className="timeline__dot" />}
            </span>
            <span className="timeline__text">
              <span className="timeline__label">{t(`status.${key}`)}</span>
              {isCurrent && <span className="timeline__tag">{t('timeline.current')}</span>}
              {/* Spoken by screen readers only */}
              {!isCurrent && (
                <span className="visually-hidden">
                  {isDone ? t('timeline.done') : t('timeline.upcoming')}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
