/**
 * Reusable button.
 *   variant: 'primary' (green), 'secondary' (blue), or 'outline' (white with green border)
 *   icon:    optional icon name from Icon.jsx, shown before the text
 *   fullWidth: stretch to the width of its container (useful on phones)
 * The text (children) must already be translated by the parent.
 */
import Icon from './Icon';
import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  icon,
  fullWidth = false,
  type = 'button',
  className = '',
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, fullWidth && 'btn--full', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}
