/**
 * Login page for all three roles.
 * After a successful login, each role goes to its own home page (ROLE_HOME).
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Input from '../../components/Input';
import PasswordInput from '../../components/PasswordInput';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { useAuth } from '../../auth/useAuth';
import { ROLE_HOME } from '../../auth/roles';
import { useLanguage } from '../../i18n/useLanguage';
import { validateLogin } from '../../utils/validation';

export default function LoginPage() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A message passed from another page, e.g. after registering or when a session expires.
  const notice = location.state?.notice;

  const [form, setForm] = useState({ username: location.state?.username || '', password: '' });
  // Errors are stored as CODES and translated when shown,
  // so they switch language instantly with the EN | TL choice.
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorCode, setErrorCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorCode(null);

    const errors = validateLogin(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await login(form.username.trim(), form.password);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      setFieldErrors(error.fields || {});
      setErrorCode(error.code);
      setSubmitting(false);
    }
  }

  const fieldError = (name) => (fieldErrors[name] ? t(`errors.${fieldErrors[name]}`) : undefined);

  return (
    <AuthLayout priorityPhoto>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-form__heading">{t('auth.loginTitle')}</h1>
        {notice === 'REGISTERED' && <Alert type="success">{t('auth.registered')}</Alert>}
        {notice && notice !== 'REGISTERED' && !errorCode && <Alert type="error">{t(`errors.${notice}`)}</Alert>}
        {errorCode && <Alert type="error">{t(`errors.${errorCode}`)}</Alert>}

        <Input
          label={t('auth.username')}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          value={form.username}
          onChange={handleChange}
          error={fieldError('username')}
        />
        <PasswordInput
          label={t('auth.password')}
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={fieldError('password')}
        />

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t('auth.loggingIn') : t('actions.logIn')}
        </Button>

        <p className="auth-form__switch">
          {t('auth.noAccount')} <Link to="/register">{t('actions.createAccount')}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
