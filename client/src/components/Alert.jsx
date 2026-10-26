/**
 * Success or error message box.
 *   type:  'success', 'error', or 'info' (a notice that is not an error)
 *   title: optional bold first line
 *   children: the message (already translated)
 * Screen readers announce it automatically when it appears.
 */
import Icon from './Icon';
import './Alert.css';

const ICONS = { success: 'checkCircle', error: 'alertCircle', info: 'alertCircle' };

export default function Alert({ type = 'success', title, children }) {
  const isError = type === 'error';

  return (
    <div className={`alert alert--${type}`} role={isError ? 'alert' : 'status'}>
      <Icon name={ICONS[type] || 'checkCircle'} className="alert__icon" />
      <div>
        {title && <p className="alert__title">{title}</p>}
        {children && <p className="alert__message">{children}</p>}
      </div>
    </div>
  );
}
