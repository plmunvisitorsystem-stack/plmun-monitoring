/**
 * Password field with a Show / Hide button.
 * Accepts the same props as Input (label, error, value, onChange...).
 */
import { useState } from 'react';
import Input from './Input';
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';

export default function PasswordInput(props) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const toggle = (
    <button
      type="button"
      className="field__group-button"
      aria-pressed={visible}
      aria-label={t(visible ? 'auth.hidePasswordLabel' : 'auth.showPasswordLabel')}
      onClick={() => setVisible((current) => !current)}
    >
      <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
      <span>{t(visible ? 'auth.hidePassword' : 'auth.showPassword')}</span>
    </button>
  );

  return <Input {...props} type={visible ? 'text' : 'password'} trailing={toggle} />;
}
