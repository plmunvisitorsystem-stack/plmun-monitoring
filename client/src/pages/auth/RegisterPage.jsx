/**
 * Registration page (residents only).
 * On success, goes to the Login page with a success message and the
 * new username already filled in.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Input from '../../components/Input';
import PasswordInput from '../../components/PasswordInput';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { validateRegistration } from '../../utils/validation';

const EMPTY_FORM = {
  name: '',
  address: '',
  contactInfo: '',
  username: '',
  password: '',
  confirmPassword: '',
  privacyConsent: false, // "I have read and agree to the Data Privacy Notice" (required)
};

export default function RegisterPage() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({}); // { field: ERROR_CODE }
  const [errorCode, setErrorCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorCode(null);

    const errors = validateRegistration(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorCode('VALIDATION_FAILED');
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate('/login', { state: { notice: 'REGISTERED', username: form.username.trim() } });
    } catch (error) {
      setFieldErrors(error.fields || {});
      setErrorCode(error.code);
      setSubmitting(false);
    }
  }

  // Shared props for each text field: value, change handler, translated error.
  const fieldProps = (name) => ({
    name,
    value: form[name],
    onChange: handleChange,
    error: fieldErrors[name] ? t(`errors.${fieldErrors[name]}`) : undefined,
  });

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="auth-form__heading">{t('actions.createAccount')}</h1>
          <p className="text-muted">{t('auth.registerIntro')}</p>
        </div>

        {errorCode && <Alert type="error">{t(`errors.${errorCode}`)}</Alert>}

        <Input label={t('auth.name')} autoComplete="name" maxLength={100} {...fieldProps('name')} />
        <Input
          label={t('auth.address')}
          hint={t('auth.addressHint')}
          autoComplete="street-address"
          maxLength={255}
          {...fieldProps('address')}
        />
        <Input
          label={t('auth.contactInfo')}
          hint={t('auth.contactHint')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          {...fieldProps('contactInfo')}
        />
        <Input
          label={t('auth.username')}
          hint={t('auth.usernameHint')}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={30}
          {...fieldProps('username')}
        />
        <PasswordInput
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          autoComplete="new-password"
          {...fieldProps('password')}
        />
        <PasswordInput
          label={t('auth.confirmPassword')}
          autoComplete="new-password"
          {...fieldProps('confirmPassword')}
        />

        {/* Data Privacy consent (RA 10173): required before the account is made */}
        <div className={`field ${fieldErrors.privacyConsent ? 'field--error' : ''}`}>
          <p className="register-privacy__intro">
            {t('privacy.registerIntro')}{' '}
            <Link to="/privacy" target="_blank" rel="noopener">
              {t('privacy.title')}
            </Link>
          </p>
          <label className="check-field register-privacy__check">
            <input
              type="checkbox"
              name="privacyConsent"
              checked={form.privacyConsent}
              onChange={handleChange}
              aria-invalid={fieldErrors.privacyConsent ? true : undefined}
              aria-describedby={fieldErrors.privacyConsent ? 'privacy-consent-error' : undefined}
            />
            <span>{t('privacy.consentLabel')}</span>
          </label>
          {fieldErrors.privacyConsent && (
            <p id="privacy-consent-error" className="field__error">
              <Icon name="alertCircle" size={18} />
              <span>{t(`errors.${fieldErrors.privacyConsent}`)}</span>
            </p>
          )}
        </div>

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t('auth.creatingAccount') : t('actions.createAccount')}
        </Button>

        <p className="auth-form__switch">
          {t('auth.haveAccount')} <Link to="/login">{t('actions.logIn')}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
