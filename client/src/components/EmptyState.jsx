/**
 * Shown when a list has nothing to display (e.g. no reports yet).
 *   icon:    icon name from Icon.jsx
 *   title:   short heading (already translated)
 *   message: one sentence explaining what will appear here
 *   action:  optional button or link
 */
import Icon from './Icon';
import './EmptyState.css';

export default function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={32} />
      </span>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
